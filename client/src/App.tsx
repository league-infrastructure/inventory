import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import KitList from './pages/kits/KitList';
import KitDetail from './pages/kits/KitDetail';
import KitForm from './pages/kits/KitForm';
import QrLanding from './pages/kits/QrLanding';
import AdminLogin from './pages/admin/AdminLogin';
import AdminLayout from './pages/admin/AdminLayout';
import EnvironmentInfo from './pages/admin/EnvironmentInfo';
import DatabaseViewer from './pages/admin/DatabaseViewer';
import ConfigPanel from './pages/admin/ConfigPanel';
import LogViewer from './pages/admin/LogViewer';
import SessionViewer from './pages/admin/SessionViewer';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/kits" element={<KitList />} />
        <Route path="/kits/new" element={<KitForm />} />
        <Route path="/kits/:id" element={<KitDetail />} />
        <Route path="/kits/:id/edit" element={<KitForm />} />
        <Route path="/k/:id" element={<QrLanding />} />
        <Route path="/p/:id" element={<QrLanding />} />
        <Route path="/admin" element={<AdminLogin />} />
        <Route element={<AdminLayout />}>
          <Route path="/admin/env" element={<EnvironmentInfo />} />
          <Route path="/admin/db" element={<DatabaseViewer />} />
          <Route path="/admin/config" element={<ConfigPanel />} />
          <Route path="/admin/logs" element={<LogViewer />} />
          <Route path="/admin/sessions" element={<SessionViewer />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
