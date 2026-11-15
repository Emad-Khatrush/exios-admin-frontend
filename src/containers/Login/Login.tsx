import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Eye, EyeOff, Lock, ShieldCheck, Truck, User, WifiOff, Wallet, BarChart3 } from 'lucide-react';
import { login } from '../../actions/session';
import { getErrorMessage } from '../../utils/errorHandler';
import { ACCOUNT_LOCKED, INVALID_CREDENTIALS, TOO_MANY_REQUESTS, USER_NOT_FOUND, USER_ROLE_INVALID, USER_SUBSCRIPTION_CANCLED } from '../../constants/errors';

import './Login.scss';

const REMEMBER_KEY = 'login_remembered_username';

// Arabic wording for the errors the login can return; anything else falls back to the shared messages
const loginErrorText = (session: any): string => {
  const id = session?.error?.message;
  if (!id) return 'تعذّر الاتصال بالخادم. تأكد من الإنترنت وحاول مرة أخرى.';
  switch (id) {
    case INVALID_CREDENTIALS: return 'اسم المستخدم أو كلمة المرور غير صحيحة.';
    case USER_NOT_FOUND: return 'لم نجد حساباً بهذا الاسم.';
    case USER_ROLE_INVALID: return 'حسابك لا يملك صلاحية الدخول إلى لوحة الإدارة.';
    case USER_SUBSCRIPTION_CANCLED: return 'هذا الحساب موقوف. تواصل مع المدير لإعادة تفعيله.';
    case ACCOUNT_LOCKED: return 'أُدخلت كلمة مرور خاطئة 10 مرات، فأوقفنا الدخول لهذا الحساب 15 دقيقة لحمايته. حاول بعدها.';
    case TOO_MANY_REQUESTS: return 'محاولات دخول كثيرة من هذا الجهاز. انتظر 10 دقائق ثم حاول مرة أخرى.';
    default: return getErrorMessage(id);
  }
};

const readRemembered = () => {
  try { return localStorage.getItem(REMEMBER_KEY) || ''; } catch { return ''; }
};

const Login = () => {
  const dispatch = useDispatch();
  const session = useSelector((state: any) => state.session);

  const remembered = readRemembered();
  const [username, setUsername] = useState(remembered);
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(Boolean(remembered));
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [touched, setTouched] = useState(false);
  const [errorDismissed, setErrorDismissed] = useState(false);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  // A failed attempt clears the password and puts the cursor back in it
  useEffect(() => {
    if (session.isError) {
      setPassword('');
      setErrorDismissed(false);
      passwordRef.current?.focus();
    }
  }, [session.isError]);

  // Same test as the private routes (token and user), so a half-saved session cannot bounce between pages
  if (localStorage.getItem('authToken') && localStorage.getItem('user')) {
    return <Navigate to="/" replace />;
  }

  const isLoading = Boolean(session.isLoading);
  const usernameMissing = touched && !username.trim();
  const passwordMissing = touched && !password;
  const showError = session.isError && !errorDismissed;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!username.trim() || !password || isLoading) return;
    try {
      if (remember) localStorage.setItem(REMEMBER_KEY, username.trim());
      else localStorage.removeItem(REMEMBER_KEY);
    } catch { /* storage blocked: nothing to remember */ }
    dispatch(login(username.toLocaleLowerCase().trim(), password) as any);
  };

  const onPasswordKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (typeof e.getModifierState === 'function') setCapsLock(e.getModifierState('CapsLock'));
  };

  return (
    <div className="login-page" dir="rtl" lang="ar">
      <aside className="login-brand" aria-hidden="true">
        <div className="login-brand__glow login-brand__glow--a" />
        <div className="login-brand__glow login-brand__glow--b" />
        <div className="login-brand__inner">
          <div className="login-brand__logo">
            <img src="/images/exios-logo-without-background.png" alt="" />
          </div>
          <h2 className="login-brand__title">لوحة تحكم إكسيوس</h2>
          <p className="login-brand__lead">إدارة الشحن والطلبيات والحسابات من مكان واحد.</p>
          <ul className="login-brand__points">
            <li><span><Truck size={18} /></span>تتبّع الشحنات والطرود من الصين حتى التسليم</li>
            <li><span><Wallet size={18} /></span>إدارة محافظ العملاء والخزينة والحسابات البنكية</li>
            <li><span><BarChart3 size={18} /></span>تقارير مالية وقيود محاسبية لحظة بلحظة</li>
          </ul>
        </div>
        <p className="login-brand__foot">جميع الحقوق محفوظة © إكسيوس {new Date().getFullYear()}</p>
      </aside>

      <main className="login-main">
        <div className="login-card">
          <img className="login-card__logo" src="/images/exios-logo-without-background.png" alt="Exios" />

          <header className="login-card__head">
            <h1>تسجيل الدخول</h1>
            <p>مرحباً بعودتك، أدخل بياناتك للمتابعة.</p>
          </header>

          {!online && (
            <div className="login-alert login-alert--warn" role="status">
              <WifiOff size={18} />
              <span>لا يوجد اتصال بالإنترنت. سيعمل الدخول عند عودة الاتصال.</span>
            </div>
          )}

          {showError && (
            <div className="login-alert login-alert--error" role="alert">
              <AlertCircle size={18} />
              <span>{loginErrorText(session)}</span>
            </div>
          )}

          <form className="login-form" onSubmit={submit} noValidate>
            <div className={`login-field${usernameMissing ? ' is-invalid' : ''}`}>
              <label htmlFor="login-username">اسم المستخدم</label>
              <div className="login-field__control">
                <User className="login-field__icon" size={18} />
                <input
                  id="login-username"
                  name="username"
                  type="text"
                  dir="rtl"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoFocus={!remembered}
                  placeholder="اكتب اسم المستخدم"
                  value={username}
                  aria-invalid={usernameMissing}
                  aria-describedby={usernameMissing ? 'login-username-err' : undefined}
                  onChange={(e) => { setUsername(e.target.value); setErrorDismissed(true); }}
                />
              </div>
              {usernameMissing && <small id="login-username-err" className="login-field__err">أدخل اسم المستخدم</small>}
            </div>

            <div className={`login-field${passwordMissing ? ' is-invalid' : ''}`}>
              <label htmlFor="login-password">كلمة المرور</label>
              <div className="login-field__control">
                <Lock className="login-field__icon" size={18} />
                <input
                  ref={passwordRef}
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  dir="rtl"
                  autoComplete="current-password"
                  autoFocus={Boolean(remembered)}
                  placeholder="اكتب كلمة المرور"
                  value={password}
                  aria-invalid={passwordMissing}
                  aria-describedby={passwordMissing ? 'login-password-err' : capsLock ? 'login-caps' : undefined}
                  onChange={(e) => { setPassword(e.target.value); setErrorDismissed(true); }}
                  onKeyDown={onPasswordKey}
                  onKeyUp={onPasswordKey}
                  onBlur={() => setCapsLock(false)}
                />
                <button
                  type="button"
                  className="login-field__toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {passwordMissing && <small id="login-password-err" className="login-field__err">أدخل كلمة المرور</small>}
              {capsLock && !passwordMissing && <small id="login-caps" className="login-field__hint">تنبيه: الأحرف الكبيرة مفعّلة (Caps Lock)</small>}
            </div>

            <div className="login-form__row">
              <label className="login-check">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                <span className="login-check__box" aria-hidden="true" />
                تذكّر اسم المستخدم
              </label>
              <span className="login-form__help" title="إعادة تعيين كلمة المرور تتم عن طريق المدير">نسيت كلمة المرور؟ تواصل مع المدير.</span>
            </div>

            <button type="submit" className="login-submit" disabled={isLoading} aria-busy={isLoading}>
              {isLoading ? (
                <><span className="login-spinner" aria-hidden="true" />جارٍ التحقق…</>
              ) : (
                <>تسجيل الدخول<ArrowLeft size={18} /></>
              )}
            </button>
          </form>

          <p className="login-card__secure"><ShieldCheck size={14} /> اتصالك آمن ومشفّر، فلا تشارك بيانات دخولك مع أحد.</p>
        </div>
      </main>
    </div>
  );
};

export default Login;
