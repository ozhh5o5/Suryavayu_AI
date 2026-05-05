import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Plants from "./pages/Plants";
import PlantDetail from "./pages/PlantDetail";
import Alerts from "./pages/Alerts";
import Models from "./pages/Models";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/plants" element={<Plants />} />
        <Route path="/plants/:id" element={<PlantDetail />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/models" element={<Models />} />
      </Route>
    </Routes>
  );
}
