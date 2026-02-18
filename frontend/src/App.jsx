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
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
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

  const bgColor = isDarkMode ? "#0a0a0a" : "#f4f5f7";
  const cardColor = isDarkMode ? "#161616" : "#ffffff";
  const textColor = isDarkMode ? "#e4e4e4" : "#111827";
  const subText = isDarkMode ? "#9ca3af" : "#6b7280";
  const borderColor = isDarkMode ? "#222" : "#e5e7eb";
  const cardShadow = isDarkMode
    ? "0 1px 3px rgba(0,0,0,0.4)"
    : "0 1px 4px rgba(0,0,0,0.06)";

  return (
    <ConfigProvider
      theme={{
        algorithm: isDarkMode ? darkAlgorithm : defaultAlgorithm,
        token: {
          colorPrimary: "#0ea5e9",
          borderRadius: 10,
        },
      }}
    >
      <Layout style={{ minHeight: "100vh", background: bgColor }}>
        <Header
          style={{
            background: "transparent",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "1.25rem 2rem",
            height: "auto",
            lineHeight: "normal",
          }}
        >
          <Title level={3} style={{ margin: 0, color: textColor, letterSpacing: "-0.02em" }}>
            Love N Fit
          </Title>
          <Switch
            checked={isDarkMode}
            onChange={setIsDarkMode}
            checkedChildren={<BulbFilled />}
            unCheckedChildren={<BulbOutlined />}
          />
        </Header>

        <Content style={{ padding: "1rem 1rem 2rem" }}>
          <div style={{ maxWidth: 1080, margin: "0 auto" }}>
            <Title
              level={2}
              style={{
                color: textColor,
                marginBottom: 4,
                textAlign: "center",
                letterSpacing: "-0.02em",
              }}
            >
              Virtual Try-On
            </Title>
            <Text
              style={{
                display: "block",
                textAlign: "center",
                color: subText,
                marginBottom: 32,
                fontSize: 15,
              }}
            >
              Upload your photo, find a Vuori product, and see how it looks on you
            </Text>

            <form onSubmit={handleSubmit}>
              {/* Equal-height two-column layout */}
              <div
                style={{
                  display: "flex",
                  gap: 20,
                  alignItems: "stretch",
                  flexWrap: "wrap",
                }}
              >
                {/* Left Column: Person Image + Measurements */}
                <div
                  style={{
                    flex: "1 1 0",
                    minWidth: 320,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div
                    style={{
                      background: cardColor,
                      padding: 24,
                      borderRadius: 14,
                      border: `1px solid ${borderColor}`,
                      boxShadow: cardShadow,
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <Title
                      level={5}
                      style={{ color: textColor, marginBottom: 16, marginTop: 0 }}
                    >
                      Your Photo & Measurements
                    </Title>

                    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                      <ImageUpload
                        onImageChange={setPersonImage}
                        isDarkMode={isDarkMode}
                      />
                    </div>

                    <div style={{ marginTop: 20 }}>
                      <div style={{ marginBottom: 14 }}>
                        <Text style={{ color: subText, fontSize: 13 }}>Height</Text>
                        <div
                          style={{ display: "flex", gap: 8, marginTop: 4 }}
                        >
                          <Select
                            placeholder="Feet"
                            style={{ flex: 1 }}
                            value={heightFeet}
                            onChange={setHeightFeet}
                          >
                            {[3, 4, 5, 6, 7].map((ft) => (
                              <Option key={ft} value={ft}>
                                {ft} ft
                              </Option>
                            ))}
                          </Select>
                          <Select
                            placeholder="Inches"
                            style={{ flex: 1 }}
                            value={heightInches}
                            onChange={setHeightInches}
                          >
                            {Array.from({ length: 12 }, (_, i) => i).map(
                              (inch) => (
                                <Option key={inch} value={inch}>
                                  {inch} in
                                </Option>
                              )
                            )}
                          </Select>
                        </div>
                      </div>

                      <div>
                        <Text style={{ color: subText, fontSize: 13 }}>Weight (lbs)</Text>
                        <InputNumber
                          placeholder="e.g. 165"
                          style={{ width: "100%", marginTop: 4 }}
                          min={50}
                          max={500}
                          value={weightLbs}
                          onChange={setWeightLbs}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Chat + Product URL */}
                <div
                  style={{
                    flex: "1 1 0",
                    minWidth: 320,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div
                    style={{
                      background: cardColor,
                      padding: 24,
                      borderRadius: 14,
                      border: `1px solid ${borderColor}`,
                      boxShadow: cardShadow,
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <Title
                      level={5}
                      style={{ color: textColor, marginBottom: 16, marginTop: 0 }}
                    >
                      Find a Product
                    </Title>

                    {/* Chat Widget */}
                    <div style={{ flex: 1, minHeight: 300 }}>
                      <ChatWidget
                        onProductSelect={(url) => setProductUrl(url)}
                        isDarkMode={isDarkMode}
                      />
                    </div>

                    {/* Product URL */}
                    <div style={{ marginTop: 16 }}>
                      <Text style={{ color: subText, fontSize: 13 }}>Product URL</Text>
                      <Input
                        placeholder="https://vuoriclothing.com/products/..."
                        style={{ marginTop: 4 }}
                        value={productUrl}
                        onChange={(e) => setProductUrl(e.target.value)}
                        size="large"
                      />
                      <Text
                        style={{
                          color: subText,
                          fontSize: 11,
                          marginTop: 6,
                          display: "block",
                        }}
                      >
                        Paste a link or pick a product from the chat above
                      </Text>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginTop: 32,
                }}
              >
                <Button
                  type="primary"
                  size="large"
                  htmlType="submit"
                  loading={loading}
                  style={{
                    height: 48,
                    width: 240,
                    fontSize: 16,
                    fontWeight: 600,
                    borderRadius: 10,
                  }}
                >
                  {loading ? "Generating..." : "Try On"}
                </Button>
              </div>
            </form>

            {/* Result Section */}
            {result && (
              <div ref={resultRef} style={{ marginTop: 64 }}>
                <Divider />
                <Title
                  level={3}
                  style={{
                    color: textColor,
                    textAlign: "center",
                    marginBottom: 28,
                    letterSpacing: "-0.02em",
                  }}
                >
                  Your Try-On Result
                </Title>

                {/* Recommended Size Badge */}
                {result.recommendedSize && (
                  <div style={{ textAlign: "center", marginBottom: 20 }}>
                    <div
                      style={{
                        display: "inline-block",
                        background: "linear-gradient(135deg, #0ea5e9, #2563eb)",
                        color: "#ffffff",
                        padding: "10px 28px",
                        borderRadius: 10,
                        fontSize: 18,
                        fontWeight: 700,
                        letterSpacing: "0.01em",
                      }}
                    >
                      Recommended Size: {result.recommendedSize}
                    </div>
                  </div>
                )}

                {/* Product Info Card */}
                {result.productInfo && (
                  <div
                    style={{
                      background: cardColor,
                      padding: 20,
                      borderRadius: 14,
                      border: `1px solid ${borderColor}`,
                      boxShadow: cardShadow,
                      maxWidth: 440,
                      margin: "0 auto 24px auto",
                      textAlign: "center",
                    }}
                  >
                    <Text
                      strong
                      style={{ color: textColor, fontSize: 17 }}
                    >
                      {result.productInfo.name}
                    </Text>
                    <br />
                    <Text style={{ color: subText, fontSize: 15 }}>
                      {result.productInfo.brand} &middot;{" "}
                      {result.productInfo.price}
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

                    {/* Love it! button — opens product page */}
                    {result.productInfo.url && (
                      <div style={{ marginTop: 16 }}>
                        <Button
                          type="primary"
                          size="large"
                          icon={<HeartFilled />}
                          onClick={() => window.open(result.productInfo.url, "_blank")}
                          style={{
                            background: "linear-gradient(135deg, #e11d48, #f43f5e)",
                            borderColor: "#e11d48",
                            fontWeight: 600,
                            borderRadius: 10,
                            height: 44,
                            paddingLeft: 24,
                            paddingRight: 24,
                            fontSize: 15,
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
                        borderRadius: 16,
                        boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
                        maxHeight: 480,
                      }}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      textAlign: "center",
                      padding: 40,
                      color: subText,
                    }}
                  >
                    Image generation was not available for this request.
                  </div>
                )}

                {/* Styling Description */}
                {result.text && (
                  <Text
                    style={{
                      display: "block",
                      textAlign: "center",
                      marginTop: 20,
                      color: textColor,
                      fontSize: "1rem",
                      lineHeight: 1.7,
                      maxWidth: 640,
                      marginLeft: "auto",
                      marginRight: "auto",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {result.text}
                  </Text>
                )}
              </div>
            )}

            {/* History Section */}
            {history.length > 0 && (
              <div style={{ marginTop: 64 }}>
                <Divider />
                <Title
                  level={4}
                  style={{ color: textColor, marginBottom: 24 }}
                >
                  Previous Results
                </Title>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                    gap: 16,
                  }}
                >
                  {history.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        background: cardColor,
                        padding: 14,
                        borderRadius: 12,
                        border: `1px solid ${borderColor}`,
                        boxShadow: cardShadow,
                      }}
                    >
                      {item.resultImage ? (
                        <img
                          src={item.resultImage}
                          alt="Previous"
                          style={{
                            width: "100%",
                            borderRadius: 8,
                            marginBottom: 10,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            height: 140,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: subText,
                            marginBottom: 10,
                            background: isDarkMode ? "#111" : "#f9f9f9",
                            borderRadius: 8,
                            fontSize: 13,
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
                            fontSize: 13,
                            marginBottom: 4,
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
                          <Tag color="blue" style={{ margin: 0 }}>
                            Size: {item.recommendedSize}
                          </Tag>
                        )}
                        <Text
                          style={{
                            color: subText,
                            fontSize: 11,
                          }}
                        >
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
