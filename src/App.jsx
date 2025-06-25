import { Route, Routes } from "react-router-dom";
import "./App.css";
import Login from "./components/Login/login";
import Dashboard from "./components/dashboard/dashboard";

function App() {
  return (
    <div>
      <Routes>
        <Route exact path="/" element={<Login />} />
        <Route exact path="/dashboard" element={<Dashboard />} />
      </Routes>
    </div>
  );
}

export default App;
