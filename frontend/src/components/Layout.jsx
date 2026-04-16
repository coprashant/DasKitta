import Navbar from "./Navbar";
import Footer from "./Footer";
import "./Layout.css";

const Layout = ({ children }) => {
  return (
    <div className="layout">
      <Navbar />
      <main className="layout-main">
        {children}
      </main>
      <Footer />
    </div>
  );
};

export default Layout;