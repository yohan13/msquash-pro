import React from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import App     from './routes/App'
import Home    from './routes/Home'
import Book    from './routes/Book'
import Profile from './routes/Profile'
import Admin   from './routes/Admin'
import './styles.css'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true,     element: <Home /> },
      { path: 'booking', element: <Book /> },
      { path: 'profile', element: <Profile /> },
      { path: 'admin',   element: <Admin /> },
    ],
  },
])

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>
)
