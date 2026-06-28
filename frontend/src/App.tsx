import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Feed from './routes/Feed';
import StoryPage from './routes/Story';
import Login from './routes/Login';
import Verify from './routes/Verify';
import ReviewQueue from './routes/admin/ReviewQueue';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Feed />} />
          <Route path="/story/:id" element={<StoryPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/admin/review" element={<ReviewQueue />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
