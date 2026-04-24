import Navbar from "./Navbar";
import Footer from "./Footer";
import "./Layout.css";

const Layout = ({ children, theme, onThemeToggle }) => {
  return (
    <div className="layout">
      <Navbar theme={theme} onThemeToggle={onThemeToggle} />
      <main className="layout-main">
        {children}
      </main>
      <Footer />
    </div>
  );
};

export default Layout;