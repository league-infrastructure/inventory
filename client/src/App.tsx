import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import AppLayout from './components/AppLayout';
import Landing from './pages/Landing';
import KitList from './pages/kits/KitList';
import KitDetail from './pages/kits/KitDetail';
import KitForm from './pages/kits/KitForm';
import RetiredKits from './pages/kits/RetiredKits';
import QrLanding from './pages/kits/QrLanding';
import QrLayout from './pages/qr/QrLayout';
import QrKitPage from './pages/qr/QrKitPage';
import QrPackPage from './pages/qr/QrPackPage';
import QrComputerPage from './pages/qr/QrComputerPage';
import ComputerList from './pages/computers/ComputerList';
import ComputerDetail from './pages/computers/ComputerDetail';
import ComputerForm from './pages/computers/ComputerForm';
import HostNameList from './pages/computers/HostNameList';
import InactiveComputers from './pages/computers/InactiveComputers';
import PackList from './pages/packs/PackList';
import SiteList from './pages/sites/SiteList';
import CheckedOutList from './pages/checkouts/CheckedOutList';
import IssueList from './pages/issues/IssueList';
import AdminLogin from './pages/admin/AdminLogin';
import AdminLayout from './pages/admin/AdminLayout';
import EnvironmentInfo from './pages/admin/EnvironmentInfo';
import DatabaseViewer from './pages/admin/DatabaseViewer';
import ConfigPanel from './pages/admin/ConfigPanel';
import LogViewer from './pages/admin/LogViewer';
import SessionViewer from './pages/admin/SessionViewer';
import PermissionsPanel from './pages/admin/PermissionsPanel';
import Account from './pages/account/Account';
import AdminTokens from './pages/admin/AdminTokens';
import ImportExport from './pages/admin/ImportExport';
import UsersPanel from './pages/admin/UsersPanel';
import CategoriesPanel from './pages/admin/CategoriesPanel';
import AuditLogViewer from './pages/reports/AuditLogViewer';
import InventoryAgeReport from './pages/reports/InventoryAgeReport';
import CheckedOutByPerson from './pages/reports/CheckedOutByPerson';

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
      <Routes>
        {/* Legacy QR short URLs (desktop redirect) */}
        <Route path="/k/:id" element={<QrLanding />} />
        <Route path="/p/:id" element={<QrLanding />} />
        <Route path="/c/:id" element={<QrLanding />} />

        {/* Mobile QR pages */}
        <Route element={<QrLayout />}>
          <Route path="/qr/k/:id" element={<QrKitPage />} />
          <Route path="/qr/p/:id" element={<QrPackPage />} />
          <Route path="/qr/c/:id" element={<QrComputerPage />} />
        </Route>

        {/* Main app with sidebar layout */}
        <Route element={<AppLayout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/kits" element={<KitList />} />
          <Route path="/kits/retired" element={<RetiredKits />} />
          <Route path="/kits/new" element={<KitForm />} />
          <Route path="/kits/:id" element={<KitDetail />} />
          <Route path="/computers" element={<ComputerList />} />
          <Route path="/computers/new" element={<ComputerForm />} />
          <Route path="/computers/inactive" element={<InactiveComputers />} />
          <Route path="/computers/:id" element={<ComputerDetail />} />
          <Route path="/hostnames" element={<HostNameList />} />
          <Route path="/packs" element={<PackList />} />
          <Route path="/checkouts" element={<CheckedOutList />} />
          <Route path="/issues" element={<IssueList />} />
          <Route path="/sites" element={<SiteList />} />
          <Route path="/reports/audit-log" element={<AuditLogViewer />} />
          <Route path="/reports/inventory-age" element={<InventoryAgeReport />} />
          <Route path="/reports/transferred-by-person" element={<CheckedOutByPerson />} />
          <Route path="/account" element={<Account />} />
          <Route path="/admin" element={<AdminLogin />} />
          <Route element={<AdminLayout />}>
            <Route path="/admin/env" element={<EnvironmentInfo />} />
            <Route path="/admin/db" element={<DatabaseViewer />} />
            <Route path="/admin/config" element={<ConfigPanel />} />
            <Route path="/admin/logs" element={<LogViewer />} />
            <Route path="/admin/sessions" element={<SessionViewer />} />
            <Route path="/admin/permissions" element={<PermissionsPanel />} />
            <Route path="/admin/tokens" element={<AdminTokens />} />
            <Route path="/admin/categories" element={<CategoriesPanel />} />
            <Route path="/admin/import-export" element={<ImportExport />} />
            <Route path="/admin/users" element={<UsersPanel />} />
          </Route>
        </Route>
      </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
