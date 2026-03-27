import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { getAuth } from '@/lib/auth'
import { TooltipProvider } from '@/components/ui/tooltip'
import Layout from '@/components/Layout'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import GroupsPage from '@/pages/GroupsPage'
import OASPage from '@/pages/OASPage'
import MCPPage from '@/pages/MCPPage'
import TokensPage from '@/pages/TokensPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  return getAuth() ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter basename="/admin-ui">
      <TooltipProvider delayDuration={600}>
      <Toaster position="top-right" richColors closeButton />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/groups" element={<GroupsPage />} />
          <Route path="/oas" element={<OASPage />} />
          <Route path="/mcp" element={<MCPPage />} />
          <Route path="/tokens" element={<TokensPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      </TooltipProvider>
    </BrowserRouter>
  )
}
