import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import Landing from './pages/Landing';
import KitList from './pages/kits/KitList';
import KitDetail from './pages/kits/KitDetail';
import KitForm from './pages/kits/KitForm';
import QrLanding from './pages/kits/QrLanding';
import ComputerList from './pages/computers/ComputerList';
import ComputerDetail from './pages/computers/ComputerDetail';
import ComputerForm from './pages/computers/ComputerForm';
import HostNameList from './pages/computers/HostNameList';
import PackList from './pages/packs/PackList';
import SiteList from './pages/sites/SiteList';
import CheckedOutList from './pages/checkouts/CheckedOutList';
import AdminLogin from './pages/admin/AdminLogin';
import AdminLayout from './pages/admin/AdminLayout';
import EnvironmentInfo from './pages/admin/EnvironmentInfo';
import DatabaseViewer from './pages/admin/DatabaseViewer';
import ConfigPanel from './pages/admin/ConfigPanel';
import LogViewer from './pages/admin/LogViewer';
import SessionViewer from './pages/admin/SessionViewer';
import PermissionsPanel from './pages/admin/PermissionsPanel';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Standalone pages (no sidebar) */}
        <Route path="/k/:id" element={<QrLanding />} />
        <Route path="/p/:id" element={<QrLanding />} />
        <Route path="/c/:id" element={<QrLanding />} />

        {/* Main app with sidebar layout */}
        <Route element={<AppLayout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/kits" element={<KitList />} />
          <Route path="/kits/new" element={<KitForm />} />
          <Route path="/kits/:id" element={<KitDetail />} />
          <Route path="/computers" element={<ComputerList />} />
          <Route path="/computers/new" element={<ComputerForm />} />
          <Route path="/computers/:id" element={<ComputerDetail />} />
          <Route path="/hostnames" element={<HostNameList />} />
          <Route path="/packs" element={<PackList />} />
          <Route path="/checkouts" element={<CheckedOutList />} />
          <Route path="/sites" element={<SiteList />} />
          <Route path="/admin" element={<AdminLogin />} />
          <Route element={<AdminLayout />}>
            <Route path="/admin/env" element={<EnvironmentInfo />} />
            <Route path="/admin/db" element={<DatabaseViewer />} />
            <Route path="/admin/config" element={<ConfigPanel />} />
            <Route path="/admin/logs" element={<LogViewer />} />
            <Route path="/admin/sessions" element={<SessionViewer />} />
            <Route path="/admin/permissions" element={<PermissionsPanel />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
