import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import IPOApply from './pages/IPOApply';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/apply" element={<IPOApply />} />
      </Routes>
    </Router>
  );
}

export default App;