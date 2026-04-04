import React from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './routes/App.jsx'
import Home from './routes/Home.jsx'
import Book from './routes/Book.jsx'
import './styles.css'

const router = createBrowserRouter([
  { path: '/', element: <App />, children: [
    { index: true, element: <Home /> },
    { path: 'booking', element: <Book /> },
  ]}
])

createRoot(document.getElementById('root')).render(<RouterProvider router={router} />)
