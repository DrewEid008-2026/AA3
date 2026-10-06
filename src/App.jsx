import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useParams } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
// Add page imports here
import Battle from '@/pages/Battle';

function BattleRoute() {
  const { missionId } = useParams();
  return <Battle key={missionId} />;
}
import MissionSelect from '@/pages/MissionSelect';
import Squad from '@/pages/Squad';
import Armory from '@/pages/Armory';
import Deploy from '@/pages/Deploy';
import ChessTable from '@/pages/ChessTable';
import BetweenMissionsLayout from '@/components/BetweenMissionsLayout';
import Title from '@/pages/Title';
import NewGame from '@/pages/NewGame';
import LoadGame from '@/pages/LoadGame';
import SaveGame from '@/pages/SaveGame';
import CampaignIntro from '@/pages/CampaignIntro';
import Tutorial from '@/pages/Tutorial';
import CampaignGuard from '@/components/CampaignGuard';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      {/* Title menu — no between-mission footer */}
      <Route path="/" element={<Title />} />
      <Route path="/new-game" element={<NewGame />} />
      <Route path="/load-game" element={<LoadGame />} />
      <Route path="/save-game" element={<SaveGame />} />

      {/* Campaign screens — guarded by an active save slot */}
      <Route element={<CampaignGuard />}>
        <Route element={<BetweenMissionsLayout />}>
          <Route path="/squad" element={<Squad />} />
          <Route path="/armory" element={<Armory />} />
          <Route path="/missions" element={<MissionSelect />} />
        </Route>
        <Route path="/campaign-intro" element={<CampaignIntro />} />
        <Route path="/tutorial" element={<Tutorial />} />
        <Route path="/deploy/:missionId" element={<Deploy />} />
        <Route path="/battle/:missionId" element={<BattleRoute />} />
        <Route path="/chess-table/:soldierId" element={<ChessTable />} />
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App