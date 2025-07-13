import { AuthProvider } from '@/providers/AuthProvider'
import { useNavigate } from 'react-router-dom'

export default function LoginPage() {
const navigate = useNavigate()
const { login } = AuthProvider()

  const handleLogin = () => {
    fakeAuth.login(() => {
      navigate('/', { replace: true })
    })
  }

  return (
    <div>
      <h2>Login Gh3spOS</h2>
      <button onClick={handleLogin}>Fai Login (finto)</button>
    </div>
  )
}
