import { useState } from 'react'

export default function Auth({ setToken, setUser }) {
  const [isLogin, setIsLogin] = useState(true)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authMessage, setAuthMessage] = useState('')

  const handleAuth = async (e) => {
    e.preventDefault()
    const endpoint = isLogin ? 'login' : 'register'
    try {
      const response = await fetch(`http://localhost:5001/api/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isLogin ? { email, password } : { name, email, password }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      if (isLogin) {
        localStorage.setItem('token', data.token)
        localStorage.setItem('user', JSON.stringify(data.user))
        setToken(data.token)
        setUser(data.user)
      } else {
        setAuthMessage('Kayıt başarılı! Giriş yapabilirsiniz.')
        setIsLogin(true)
      }
    } catch (err) { setAuthMessage(err.message) }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2>{isLogin ? 'Asana\'ya Giriş Yap' : 'Kayıt Ol'}</h2>
        <form onSubmit={handleAuth} style={styles.form}>
          {!isLogin && <input type="text" placeholder="Ad Soyad" value={name} onChange={e => setName(e.target.value)} style={styles.input} required />}
          <input type="email" placeholder="E-posta" value={email} onChange={e => setEmail(e.target.value)} style={styles.input} required />
          <input type="password" placeholder="Şifre" value={password} onChange={e => setPassword(e.target.value)} style={styles.input} required />
          <button type="submit" style={styles.button}>{isLogin ? 'Giriş Yap' : 'Kayıt Ol'}</button>
        </form>
        {authMessage && <p style={{ textAlign: 'center', color: 'red' }}>{authMessage}</p>}
        <p onClick={() => setIsLogin(!isLogin)} style={{ textAlign: 'center', cursor: 'pointer', color: '#4F46E5', marginTop: '1rem' }}>
          {isLogin ? 'Hesap Oluştur' : 'Zaten üye misin? Giriş yap'}
        </p>
      </div>
    </div>
  )
}

const styles = {
  container: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--bg-tertiary)', fontFamily: 'system-ui' },
  card: { backgroundColor: 'var(--bg-primary)', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '400px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  input: { padding: '0.75rem', borderRadius: '6px', border: '1px solid #D1D5DB' },
  button: { padding: '0.75rem', backgroundColor: '#4F46E5', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }
}
