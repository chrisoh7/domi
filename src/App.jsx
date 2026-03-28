import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Navbar from './components/Navbar'
import Login from './pages/Login'
import Feed from './pages/Feed'
import PostTask from './pages/PostTask'
import TaskDetail from './pages/TaskDetail'
import EditTask from './pages/EditTask'
import Profile from './pages/Profile'
import TokenShop from './pages/TokenShop'
import AdminQueue from './pages/AdminQueue'

function Layout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main>{children}</main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/feed" replace />} />

          <Route path="/feed" element={
            <ProtectedRoute><Layout><Feed /></Layout></ProtectedRoute>
          } />
          <Route path="/post" element={
            <ProtectedRoute><Layout><PostTask /></Layout></ProtectedRoute>
          } />
          <Route path="/task/:id" element={
            <ProtectedRoute><Layout><TaskDetail /></Layout></ProtectedRoute>
          } />
          <Route path="/task/:id/edit" element={
            <ProtectedRoute><Layout><EditTask /></Layout></ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>
          } />
          <Route path="/profile/:id" element={
            <ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>
          } />
          <Route path="/tokens" element={
            <ProtectedRoute><Layout><TokenShop /></Layout></ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute><Layout><AdminQueue /></Layout></ProtectedRoute>
          } />
        </Routes>
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </BrowserRouter>
  )
}
