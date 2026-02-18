import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Select } from "antd";
import {
  Layout,
  ConfigProvider,
  theme,
  Button,
  Typography,
  Switch,
  Input,
  InputNumber,
  Divider,
  Tag,
} from "antd";
import {
  BulbOutlined,
  BulbFilled,
  HeartFilled,
} from "@ant-design/icons";

import ImageUpload from "./components/ImageUpload";
import ChatWidget from "./components/ChatWidget";
import Footer from "./components/Footer";

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;

function App() {
  const [personImage, setPersonImage] = useState(null);
  const [productUrl, setProductUrl] = useState("");
  const [heightFeet, setHeightFeet] = useState(null);
  const [heightInches, setHeightInches] = useState(null);
  const [weightLbs, setWeightLbs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedMode = localStorage.getItem("darkMode");
    return savedMode ? JSON.parse(savedMode) : false;
  });

  const resultRef = useRef(null);
  const { defaultAlgorithm, darkAlgorithm } = theme;

  useEffect(() => {
    localStorage.setItem("darkMode", JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  useEffect(() => {
    if (result && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [result]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!personImage) {
      toast.error("Please upload your photo");
      return;
    }
    if (!productUrl) {
      toast.error("Please enter a Vuori product URL");
      return;
    }
    if (
      !productUrl.match(
        /^https?:\/\/(www\.)?vuoriclothing\.com\/products\/.+/
      )
    ) {
      toast.error("Please enter a valid Vuori product URL");
      return;
    }
    if (heightFeet === null) {
      toast.error("Please select your height");
      return;
    }
    if (weightLbs === null) {
      toast.error("Please enter your weight");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("person_image", personImage);
    formData.append("product_url", productUrl);
    formData.append("height_feet", heightFeet);
    formData.append("height_inches", heightInches || 0);
    formData.append("weight_lbs", weightLbs);
    formData.append("instructions", "");

    try {
      const response = await axios.post(
        "http://localhost:8000/api/try-on",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      const newResult = {
        id: Date.now(),
        resultImage: response.data.image,
        text: response.data.text,
        recommendedSize: response.data.recommended_size,
        productInfo: response.data.product_info,
        timestamp: new Date().toLocaleString(),
      };

      setResult(newResult);
      setHistory((prev) => [newResult, ...prev]);
      toast.success("Virtual try-on completed!");
    } catch (error) {
      toast.error(
        error.response?.data?.detail || "An error occurred during processing"
      );
    } finally {
      setLoading(false);
    }
  };

  // Vuori-inspired palette
  const bgColor = isDarkMode ? "#0c0c0c" : "#FAFAF8";
  const cardColor = isDarkMode ? "#151515" : "#FFFFFF";
  const textColor = isDarkMode ? "#e0e0e0" : "#2D3C4C";
  const subText = isDarkMode ? "#888" : "#727272";
  const borderColor = isDarkMode ? "#222" : "#E8E8E8";
  const accent = isDarkMode ? "#4A90A4" : "#2D3C4C";
  const cardShadow = isDarkMode
    ? "none"
    : "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)";

  return (
    <ConfigProvider
      theme={{
        algorithm: isDarkMode ? darkAlgorithm : defaultAlgorithm,
        token: {
          colorPrimary: accent,
          borderRadius: 8,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        },
      }}
    >
      <Layout style={{ minHeight: "100vh", background: bgColor }}>
        {/* Header */}
        <Header
          style={{
            background: isDarkMode ? "#111" : "#FFFFFF",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0 2rem",
            height: 56,
            lineHeight: "56px",
            borderBottom: `1px solid ${borderColor}`,
          }}
        >
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: textColor,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Love N Fit
          </span>
          <Switch
            checked={isDarkMode}
            onChange={setIsDarkMode}
            checkedChildren={<BulbFilled />}
            unCheckedChildren={<BulbOutlined />}
            style={{ backgroundColor: isDarkMode ? "#4A90A4" : undefined }}
          />
        </Header>

        <Content style={{ padding: "2rem 1.5rem" }}>
          <div style={{ maxWidth: 1040, margin: "0 auto" }}>
            {/* Hero */}
            <div style={{ textAlign: "center", marginBottom: 36 }}>
              <h1
                style={{
                  color: textColor,
                  fontSize: 28,
                  fontWeight: 700,
                  margin: "0 0 6px 0",
                  letterSpacing: "-0.01em",
                }}
              >
                Virtual Try-On
              </h1>
              <p style={{ color: subText, fontSize: 15, margin: 0 }}>
                Upload your photo, find a Vuori product, and see how it looks on you
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Two-column layout */}
              <div
                style={{
                  display: "flex",
                  gap: 20,
                  alignItems: "stretch",
                  flexWrap: "wrap",
                }}
              >
                {/* Left Column */}
                <div style={{ flex: "1 1 0", minWidth: 340, display: "flex", flexDirection: "column" }}>
                  <div
                    style={{
                      background: cardColor,
                      padding: "20px 22px",
                      borderRadius: 14,
                      border: `1px solid ${borderColor}`,
                      boxShadow: cardShadow,
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <h3
                      style={{
                        color: textColor,
                        fontSize: 13,
                        fontWeight: 600,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        margin: "0 0 16px 0",
                      }}
                    >
                      Your Photo
                    </h3>

                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <ImageUpload
                        onImageChange={setPersonImage}
                        isDarkMode={isDarkMode}
                      />
                    </div>

                    {/* Measurements */}
                    <div
                      style={{
                        marginTop: 20,
                        paddingTop: 16,
                        borderTop: `1px solid ${borderColor}`,
                      }}
                    >
                      <h3
                        style={{
                          color: textColor,
                          fontSize: 13,
                          fontWeight: 600,
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                          margin: "0 0 12px 0",
                        }}
                      >
                        Measurements
                      </h3>

                      <div style={{ marginBottom: 12 }}>
                        <Text style={{ color: subText, fontSize: 12.5, display: "block", marginBottom: 4 }}>
                          Height
                        </Text>
                        <div style={{ display: "flex", gap: 8 }}>
                          <Select
                            placeholder="Feet"
                            style={{ flex: 1 }}
                            value={heightFeet}
                            onChange={setHeightFeet}
                          >
                            {[3, 4, 5, 6, 7].map((ft) => (
                              <Option key={ft} value={ft}>{ft} ft</Option>
                            ))}
                          </Select>
                          <Select
                            placeholder="Inches"
                            style={{ flex: 1 }}
                            value={heightInches}
                            onChange={setHeightInches}
                          >
                            {Array.from({ length: 12 }, (_, i) => i).map((inch) => (
                              <Option key={inch} value={inch}>{inch} in</Option>
                            ))}
                          </Select>
                        </div>
                      </div>

                      <div>
                        <Text style={{ color: subText, fontSize: 12.5, display: "block", marginBottom: 4 }}>
                          Weight (lbs)
                        </Text>
                        <InputNumber
                          placeholder="e.g. 165"
                          style={{ width: "100%" }}
                          min={50}
                          max={500}
                          value={weightLbs}
                          onChange={setWeightLbs}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div style={{ flex: "1 1 0", minWidth: 340, display: "flex", flexDirection: "column" }}>
                  <div
                    style={{
                      background: cardColor,
                      padding: "20px 22px",
                      borderRadius: 14,
                      border: `1px solid ${borderColor}`,
                      boxShadow: cardShadow,
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <h3
                      style={{
                        color: textColor,
                        fontSize: 13,
                        fontWeight: 600,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        margin: "0 0 16px 0",
                      }}
                    >
                      Find a Product
                    </h3>

                    {/* Chat Widget — fixed max height with internal scroll */}
                    <div style={{ flex: 1, minHeight: 280, maxHeight: 400, overflow: "hidden" }}>
                      <ChatWidget
                        onProductSelect={(url) => setProductUrl(url)}
                        isDarkMode={isDarkMode}
                      />
                    </div>

                    {/* Product URL */}
                    <div
                      style={{
                        marginTop: 16,
                        paddingTop: 14,
                        borderTop: `1px solid ${borderColor}`,
                      }}
                    >
                      <Text style={{ color: subText, fontSize: 12.5, display: "block", marginBottom: 4 }}>
                        Product URL
                      </Text>
                      <Input
                        placeholder="https://vuoriclothing.com/products/..."
                        value={productUrl}
                        onChange={(e) => setProductUrl(e.target.value)}
                        size="large"
                        style={{ borderColor }}
                      />
                      <Text style={{ color: subText, fontSize: 11, marginTop: 5, display: "block" }}>
                        Paste a link or pick a product from the chat above
                      </Text>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div style={{ display: "flex", justifyContent: "center", marginTop: 28 }}>
                <Button
                  type="primary"
                  size="large"
                  htmlType="submit"
                  loading={loading}
                  style={{
                    height: 48,
                    width: 220,
                    fontSize: 15,
                    fontWeight: 600,
                    borderRadius: 10,
                    letterSpacing: "0.02em",
                    background: accent,
                    borderColor: accent,
                  }}
                >
                  {loading ? "Generating..." : "Let me Try On"}
                </Button>
              </div>
            </form>

            {/* ── Result Section ── */}
            {result && (
              <div ref={resultRef} style={{ marginTop: 56 }}>
                <Divider style={{ borderColor }} />
                <h2
                  style={{
                    color: textColor,
                    textAlign: "center",
                    fontSize: 22,
                    fontWeight: 700,
                    marginBottom: 24,
                    letterSpacing: "-0.01em",
                  }}
                >
                  Your Try-On Result
                </h2>

                {/* Recommended Size */}
                {result.recommendedSize && (
                  <div style={{ textAlign: "center", marginBottom: 20 }}>
                    <span
                      style={{
                        display: "inline-block",
                        background: accent,
                        color: "#fff",
                        padding: "10px 28px",
                        borderRadius: 8,
                        fontSize: 17,
                        fontWeight: 700,
                        letterSpacing: "0.02em",
                      }}
                    >
                      Recommended Size: {result.recommendedSize}
                    </span>
                  </div>
                )}

                {/* Product Info Card */}
                {result.productInfo && (
                  <div
                    style={{
                      background: cardColor,
                      padding: "18px 24px",
                      borderRadius: 14,
                      border: `1px solid ${borderColor}`,
                      boxShadow: cardShadow,
                      maxWidth: 420,
                      margin: "0 auto 24px auto",
                      textAlign: "center",
                    }}
                  >
                    <Text strong style={{ color: textColor, fontSize: 16 }}>
                      {result.productInfo.name}
                    </Text>
                    <br />
                    <Text style={{ color: subText, fontSize: 14 }}>
                      {result.productInfo.brand} &middot; {result.productInfo.price}
                    </Text>
                    {result.productInfo.material && (
                      <>
                        <br />
                        <Text style={{ color: subText, fontSize: 12 }}>
                          {result.productInfo.material}
                        </Text>
                      </>
                    )}
                    {result.productInfo.available_sizes?.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        {result.productInfo.available_sizes.map((s) => (
                          <Tag
                            key={s.size}
                            color={
                              s.size === result.recommendedSize
                                ? "blue"
                                : s.available
                                ? "default"
                                : "red"
                            }
                            style={{ margin: 2 }}
                          >
                            {s.size}
                            {!s.available && " (sold out)"}
                          </Tag>
                        ))}
                      </div>
                    )}

                    {/* Love it! */}
                    {result.productInfo.url && (
                      <div style={{ marginTop: 16 }}>
                        <Button
                          type="primary"
                          size="large"
                          icon={<HeartFilled />}
                          onClick={() => window.open(result.productInfo.url, "_blank")}
                          style={{
                            background: "#c0392b",
                            borderColor: "#c0392b",
                            fontWeight: 600,
                            borderRadius: 8,
                            height: 42,
                            paddingLeft: 24,
                            paddingRight: 24,
                            fontSize: 14,
                          }}
                        >
                          Love it! Buy now
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Try-On Image */}
                {result.resultImage ? (
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <img
                      src={result.resultImage}
                      alt="Try-On Result"
                      style={{
                        borderRadius: 14,
                        boxShadow: isDarkMode
                          ? "0 8px 24px rgba(0,0,0,0.5)"
                          : "0 8px 28px rgba(0,0,0,0.1)",
                        maxHeight: 480,
                      }}
                    />
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: 40, color: subText }}>
                    Image generation was not available for this request.
                  </div>
                )}

                {/* Description */}
                {result.text && (
                  <p
                    style={{
                      textAlign: "center",
                      marginTop: 20,
                      color: textColor,
                      fontSize: 14.5,
                      lineHeight: 1.7,
                      maxWidth: 600,
                      marginLeft: "auto",
                      marginRight: "auto",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {result.text}
                  </p>
                )}
              </div>
            )}

            {/* ── History ── */}
            {history.length > 0 && (
              <div style={{ marginTop: 56 }}>
                <Divider style={{ borderColor }} />
                <h3
                  style={{
                    color: textColor,
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    marginBottom: 20,
                  }}
                >
                  Previous Results
                </h3>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                    gap: 14,
                  }}
                >
                  {history.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        background: cardColor,
                        padding: 12,
                        borderRadius: 12,
                        border: `1px solid ${borderColor}`,
                        boxShadow: cardShadow,
                      }}
                    >
                      {item.resultImage ? (
                        <img
                          src={item.resultImage}
                          alt="Previous"
                          style={{ width: "100%", borderRadius: 8, marginBottom: 8 }}
                        />
                      ) : (
                        <div
                          style={{
                            height: 130,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: subText,
                            marginBottom: 8,
                            background: isDarkMode ? "#111" : "#f8f8f6",
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                        >
                          No image
                        </div>
                      )}
                      {item.productInfo && (
                        <Text
                          strong
                          style={{
                            display: "block",
                            color: textColor,
                            fontSize: 12.5,
                            marginBottom: 3,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.productInfo.name}
                        </Text>
                      )}
                      <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
                        {item.recommendedSize && (
                          <Tag color="blue" style={{ margin: 0, fontSize: 10.5 }}>
                            {item.recommendedSize}
                          </Tag>
                        )}
                        <Text style={{ color: subText, fontSize: 10.5 }}>
                          {item.timestamp}
                        </Text>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Content>

        <Footer isDarkMode={isDarkMode} />
        <ToastContainer theme={isDarkMode ? "dark" : "light"} />
      </Layout>
    </ConfigProvider>
  );
}

export default App;
