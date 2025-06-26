import { Route, Routes } from "react-router-dom";
import "./App.css";
import Login from "./components/Login/login";
import Dashboard from "./components/dashboard/dashboard";
import Signup from "./components/Login/signup";

function App() {
  return (
    <div>
      <Routes>
        <Route exact path="/" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route exact path="/dashboard" element={<Dashboard />} />
      </Routes>
    </div>
  );
}

export default App;
