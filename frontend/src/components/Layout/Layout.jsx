import { useAuth } from "../../context/AuthContext";
import Navbar from "../Navbar/Navbar";
import Footer from "../Footer/Footer";
import MobileTabBar from "../MobileTabBar/MobileTabBar";
import "./Layout.css";

const Layout = ({ children }) => {
    const { user } = useAuth();

    return (
        <div className="layout">
            <Navbar />
            <main className="layout-main" id="main-content">
                {children}
            </main>
            <Footer />
            {user && <MobileTabBar />}
        </div>
    );
};

export default Layout;