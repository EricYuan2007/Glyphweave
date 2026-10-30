= 01 · 勾股关系
$ a^2 + b^2 = c^2 $
= 02 · 上下标
$ x_(i,j)^(t+1) = x_(i,j)^t + Delta x_i $
= 03 · 行内分式
正文前后都有文字，$p = a/b$ 应与这一行自然相接。
= 04 · 独立分式
$ f(x) = (x^2 + 1)/(x + 1) $
= 05 · 连分式
$ x = 1 + 1/(2 + 1/(3 + 1/4)) $
= 06 · 二项系数
$ binom(n, k) = n!/(k! (n-k)!) $
= 07 · 平方根
$ x = (-b + sqrt(b^2 - 4 a c))/(2 a) $
= 08 · 高次根
$ root(3, x^3 + y^3) $
= 09 · 重音与向量
$ hat(theta) + macron(x) + arrow(v) + dot(x) + dot.double(x) $
= 10 · 数学字母
$ bb(R) subset bb(C), quad cal(L) = sum_i ell_i $
= 11 · 求和上下限
$ sum_(i=1)^n i = (n(n+1))/2 $
= 12 · 积分与微分
$ integral_0^1 x^2 dif x = 1/3 $
= 13 · 双重积分
$ integral_0^1 integral_0^1 x y dif x dif y = 1/4 $
= 14 · 极限
$ lim_(x -> 0) sin(x)/x = 1 $
= 15 · 连乘
$ product_(k=1)^n k = n! $
= 16 · 长括号
$ lr((sum_(i=1)^n x_i^2))^(1/2) $
= 17 · 向上取整
$ L = ceil(N/c) $
= 18 · 范数与绝对值
$ norm(x)_2 = sqrt(sum_i abs(x_i)^2) $
= 19 · 带注释的下括号
$ underbrace(x_1 + dots + x_n, n "项") $
= 20 · 带注释的上括号
$ overbrace(a + b + c, "已知") + d $
= 21 · 二阶矩阵
$ A = mat(1, 2; 3, 4) $
= 22 · 三阶矩阵
$ I = mat(1, 0, 0; 0, 1, 0; 0, 0, 1) $
= 23 · 分式矩阵
$ A = mat(1/2, 1/3; 1/4, 1/5) $
= 24 · 带上下标的矩阵
$ A = mat(a_11, a_12; a_21, a_22) $
= 25 · 行列式
$ det(A) = mat(delim: "|", a, b; c, d) = a d - b c $
= 26 · 列向量
$ bold(v) = vec(x, y, z) $
= 27 · 方括号矩阵
$ A = mat(delim: "[", a, b; c, d) $
= 28 · 省略号矩阵
$ A = mat(a_11, dots.h, a_(1 n); dots.v, dots.down, dots.v; a_(m 1), dots.h, a_(m n)) $
= 29 · 嵌套矩阵
$ M = mat(mat(1, 0; 0, 1), 0; 0, mat(2, 0; 0, 2)) $
= 30 · 方程组
$ cases(x + y &= 3, 2 x - y &= 0) $
= 31 · 中文分段与分式
$ L(N) = cases(ceil(N/c) &"若" N > 0, 0 &"若" N = 0) $
= 32 · 英文分段
$ abs(x) = cases(x &"if" x >= 0, -x &"otherwise") $
= 33 · 三行分段
$ op("sgn")(x) = cases(-1 &x < 0, 0 &x = 0, 1 &x > 0) $
= 34 · 分段中有求和
$ f(n) = cases(sum_(k=1)^n k &n >= 1, 0 &n = 0) $
= 35 · 分段中有根式
$ f(x) = cases(sqrt(1 - x^2) &abs(x) <= 1, 0 &abs(x) > 1) $
= 36 · 长条件
$ f(x) = cases(1 &"当且仅当" x in bb(Q), 0 &"其他情况") $
= 37 · 两行推导
$ H &approx L s lambda \
    &approx ceil(N/c) s lambda $
= 38 · 三行推导
$ (a+b)^2 &= (a+b)(a+b) \
          &= a^2 + a b + b a + b^2 \
          &= a^2 + 2 a b + b^2 $
= 39 · 多组对齐点
$ a &= b + c, & d &= e + f \
  x &= y + z, & u &= v + w $
= 40 · 无对齐点换行
$ a + b + c \
  d + e + f $
= 41 · 推导中嵌套分段
$ f(x) &= cases(x^2 &x >= 0, -x &x < 0) \
  f(0) &= 0 $
= 42 · 推导中嵌套矩阵
$ A &= mat(1, 2; 3, 4) \
  A^T &= mat(1, 3; 2, 4) $
= 43 · 分段中嵌套矩阵
$ A(t) = cases(mat(1, t; 0, 1) &t >= 0, mat(1, 0; t, 1) &t < 0) $
= 44 · 矩阵中嵌套分段
$ A = mat(cases(x &x > 0, 0 &x <= 0), 1; 0, 1) $
= 45 · 行内矩阵
向量 $vec(x, y)$ 与正文并列时，字符应清楚可读。
= 46 · 行内上下限
当 $sum_(i=1)^n x_i = 0$ 时，继续阅读后面的文字。
= 47 · 行内分段
定义 $f(x) = cases(x &x > 0, 0 &x <= 0)$ 后继续正文。
= 48 · 超宽公式
$ (a + b + c + d + e + f + g + h + i + j)^2 = sum_(k=1)^10 x_k^2 + 2 sum_(1 <= i < j <= 10) x_i x_j $
= 49 · 显式空白与正体文字
$ P(A | B) = P(A inter B)/P(B), quad P(B) > 0 quad "概率" $
= 50 · 多行积分推导
$ integral_0^1 (x + x^2) dif x &= integral_0^1 x dif x + integral_0^1 x^2 dif x \
                             &= 1/2 + 1/3 \
                             &= 5/6 $
