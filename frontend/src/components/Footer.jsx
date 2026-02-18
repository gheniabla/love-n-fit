const Footer = ({ isDarkMode }) => {
  return (
    <footer
      style={{
        padding: "1.25rem 1rem",
        textAlign: "center",
        marginTop: "3rem",
        borderTop: `1px solid ${isDarkMode ? "#222" : "#E8E8E8"}`,
      }}
    >
      <span style={{ color: isDarkMode ? "#555" : "#999", fontSize: 12.5, letterSpacing: "0.02em" }}>
        Love N Fit  ·  {new Date().getFullYear()}
      </span>
    </footer>
  );
};

export default Footer;
