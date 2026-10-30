use std::{borrow::Cow, fs, path::PathBuf};
use typst::{
    diag::{FileError, FileResult},
    foundations::Bytes,
    syntax::{FileId, Source, VirtualRoot},
};
use typst_as_lib::file_resolver::FileResolver;
pub(crate) struct FixedWorld<'a> {
    pub(crate) inner: &'a dyn typst::World,
    pub(crate) epoch: i64,
}
impl typst::World for FixedWorld<'_> {
    fn library(&self) -> &typst::utils::LazyHash<typst::Library> {
        self.inner.library()
    }
    fn book(&self) -> &typst::utils::LazyHash<typst::text::FontBook> {
        self.inner.book()
    }
    fn main(&self) -> FileId {
        self.inner.main()
    }
    fn source(&self, id: FileId) -> FileResult<Source> {
        self.inner.source(id)
    }
    fn file(&self, id: FileId) -> FileResult<Bytes> {
        self.inner.file(id)
    }
    fn font(&self, index: usize) -> Option<typst::text::Font> {
        self.inner.font(index)
    }
    fn today(
        &self,
        offset: Option<typst::foundations::Duration>,
    ) -> Option<typst::foundations::Datetime> {
        use chrono::Datelike;
        let seconds = offset.map(|o| o.seconds()).unwrap_or(0.0);
        let timestamp = self.epoch.checked_add(seconds as i64)?;
        let dt = chrono::DateTime::from_timestamp(timestamp, 0)?;
        typst::foundations::Datetime::from_ymd(dt.year(), dt.month() as u8, dt.day() as u8)
    }
}
pub(crate) struct SafeFiles {
    pub(crate) root: PathBuf,
}
impl SafeFiles {
    fn bytes(&self, id: FileId) -> FileResult<Vec<u8>> {
        let base = match id.root() {
            VirtualRoot::Package(package) => {
                let home = std::env::var_os("HOME")
                    .map(PathBuf::from)
                    .unwrap_or_default();
                let data = if cfg!(target_os = "macos") {
                    home.join("Library/Application Support")
                } else {
                    std::env::var_os("XDG_DATA_HOME")
                        .map(PathBuf::from)
                        .unwrap_or(home.join(".local/share"))
                };
                let cache = if cfg!(target_os = "macos") {
                    home.join("Library/Caches")
                } else {
                    std::env::var_os("XDG_CACHE_HOME")
                        .map(PathBuf::from)
                        .unwrap_or(home.join(".cache"))
                };
                let roots = [
                    std::env::var_os("TYPST_PACKAGE_PATH")
                        .map(PathBuf::from)
                        .unwrap_or(data.join("typst/packages")),
                    std::env::var_os("TYPST_PACKAGE_CACHE_PATH")
                        .map(PathBuf::from)
                        .unwrap_or(cache.join("typst/packages")),
                ];
                roots.iter().find_map(|root| {
                    let parent=root.canonicalize().ok()?;
                    let folder=parent.join(package.namespace.as_str()).join(package.name.as_str()).join(package.version.to_string()).canonicalize().ok()?;
                    folder.starts_with(&parent).then_some(folder)
                }).ok_or_else(||FileError::Other(Some("Typst package is not cached; fetch with the Typst CLI or vendor it locally".into())))?
            }
            _ => self.root.clone(),
        };
        let path = id
            .vpath()
            .realize(&base)
            .map_err(|_| FileError::AccessDenied)?;
        let real = path
            .canonicalize()
            .map_err(|e| FileError::from_io(e, &path))?;
        if !real.starts_with(&base) {
            return Err(FileError::AccessDenied);
        }
        fs::read(&real).map_err(|e| FileError::from_io(e, &real))
    }
}
impl FileResolver for SafeFiles {
    fn resolve_binary(&self, id: FileId) -> FileResult<Cow<'_, Bytes>> {
        Ok(Cow::Owned(Bytes::new(self.bytes(id)?)))
    }
    fn resolve_source(&self, id: FileId) -> FileResult<Cow<'_, Source>> {
        let text = String::from_utf8(self.bytes(id)?).map_err(|_| FileError::InvalidUtf8)?;
        Ok(Cow::Owned(Source::new(id, text)))
    }
}
