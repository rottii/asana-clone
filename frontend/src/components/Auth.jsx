import { useState } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import { apiFetch } from '../api'

export default function Auth({ setToken, setUser }) {
  const [isLogin, setIsLogin] = useState(true)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [authMessage, setAuthMessage] = useState('')

  const handleAuth = async (e) => {
    e.preventDefault()
    const endpoint = isLogin ? 'login' : 'register'
    try {
      const response = await apiFetch(`/api/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isLogin ? { email, password, rememberMe } : { name, email, password, rememberMe }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      if (isLogin) {
        localStorage.setItem('token', data.token)
        if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken)
        localStorage.setItem('user', JSON.stringify(data.user))
        setToken(data.token)
        setUser(data.user)
      } else {
        setAuthMessage('Kayıt başarılı! Giriş yapabilirsiniz.')
        setIsLogin(true)
      }
    } catch (err) { setAuthMessage(err.message) }
  }

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const response = await apiFetch(`/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: credentialResponse.credential, rememberMe }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      localStorage.setItem('token', data.token)
      if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken)
      localStorage.setItem('user', JSON.stringify(data.user))
      setToken(data.token)
      setUser(data.user)
    } catch (err) {
      setAuthMessage(err.message || 'Google ile giriş başarısız oldu.')
    }
  }

  const handleGoogleError = () => {
    setAuthMessage('Google ile giriş başarısız oldu.')
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2>{isLogin ? 'Asana\'ya Giriş Yap' : 'Kayıt Ol'}</h2>
        
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem', marginTop: '1rem' }}>
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            theme="outline"
            size="large"
            text={isLogin ? "signin_with" : "signup_with"}
            shape="rectangular"
            width="100%"
          />
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', margin: '1rem 0' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#E5E7EB' }}></div>
          <span style={{ margin: '0 10px', color: '#6B7280', fontSize: '0.875rem' }}>veya email ile</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#E5E7EB' }}></div>
        </div>

        <form onSubmit={handleAuth} style={styles.form}>
          {!isLogin && <input type="text" placeholder="Ad Soyad" value={name} onChange={e => setName(e.target.value)} style={styles.input} required />}
          <input type="email" placeholder="E-posta" value={email} onChange={e => setEmail(e.target.value)} style={styles.input} required />
          <input type="password" placeholder="Şifre" value={password} onChange={e => setPassword(e.target.value)} style={styles.input} required />
          
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#4B5563', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={rememberMe} 
              onChange={(e) => setRememberMe(e.target.checked)} 
            />
            Oturumumu açık tut (30 gün)
          </label>

          <button type="submit" style={styles.button}>{isLogin ? 'Giriş Yap' : 'Kayıt Ol'}</button>
        </form>
        {authMessage && <p style={{ textAlign: 'center', color: 'red', marginTop: '1rem' }}>{authMessage}</p>}
        <p onClick={() => setIsLogin(!isLogin)} style={{ textAlign: 'center', cursor: 'pointer', color: '#4F46E5', marginTop: '1.5rem' }}>
          {isLogin ? 'Hesap Oluştur' : 'Zaten üye misin? Giriş yap'}
        </p>
      </div>
    </div>
  )
}

const styles = {
  container: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--bg-tertiary)', fontFamily: 'system-ui' },
  card: { backgroundColor: 'var(--bg-primary)', padding: '2.5rem 2rem', borderRadius: '12px', width: '100%', maxWidth: '420px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  input: { padding: '0.75rem', borderRadius: '6px', border: '1px solid #D1D5DB' },
  button: { padding: '0.75rem', backgroundColor: '#4F46E5', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }
}
