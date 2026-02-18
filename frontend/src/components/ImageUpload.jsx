import { useState } from "react";
import { Upload, Typography, message } from "antd";
import { UserOutlined, CloseCircleOutlined, CameraOutlined } from "@ant-design/icons";

const { Dragger } = Upload;

const ImageUpload = ({ onImageChange, isDarkMode = false }) => {
  const [preview, setPreview] = useState(null);

  const uploadProps = {
    name: "file",
    multiple: false,
    maxCount: 1,
    accept: "image/*",
    showUploadList: false,
    beforeUpload: (file) => {
      const isImage = file.type.startsWith("image/");
      if (!isImage) {
        message.error("You can only upload image files!");
        return Upload.LIST_IGNORE;
      }

      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        message.error("Image must be smaller than 10MB!");
        return Upload.LIST_IGNORE;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
        onImageChange(file);
      };
      reader.readAsDataURL(file);
      return false;
    },
  };

  const handleRemove = () => {
    setPreview(null);
    onImageChange(null);
  };

  const accent = isDarkMode ? "#4A90A4" : "#2D3C4C";

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
      {preview ? (
        <div style={{ position: "relative", display: "inline-block" }}>
          <img
            src={preview}
            alt="Preview"
            style={{
              display: "block",
              maxHeight: 200,
              maxWidth: "100%",
              borderRadius: 12,
              objectFit: "contain",
              boxShadow: isDarkMode
                ? "0 4px 16px rgba(0,0,0,0.4)"
                : "0 4px 16px rgba(0,0,0,0.08)",
            }}
          />
          <CloseCircleOutlined
            onClick={handleRemove}
            style={{
              position: "absolute",
              top: -8,
              right: -8,
              fontSize: 22,
              color: isDarkMode ? "#f87171" : "#ef4444",
              backgroundColor: isDarkMode ? "#1a1a1a" : "#ffffff",
              borderRadius: "50%",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              zIndex: 10,
            }}
          />
        </div>
      ) : (
        <Dragger
          {...uploadProps}
          style={{
            width: "100%",
            border: `2px dashed ${isDarkMode ? "#333" : "#d4d4d4"}`,
            borderRadius: 14,
            backgroundColor: isDarkMode ? "#151515" : "#fafaf9",
            padding: "20px 16px",
            transition: "border-color 0.2s ease",
          }}
          className="upload-dragger"
        >
          {/* Person silhouette icon */}
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              backgroundColor: isDarkMode ? "#1e2a30" : "#e8eff2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px auto",
            }}
          >
            <UserOutlined style={{ fontSize: 32, color: accent }} />
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 4 }}>
            <CameraOutlined style={{ fontSize: 14, color: accent }} />
            <span style={{ color: isDarkMode ? "#d4d4d4" : "#2D3C4C", fontSize: 14, fontWeight: 500 }}>
              Upload your photo
            </span>
          </div>

          <p style={{ fontSize: 12, color: isDarkMode ? "#666" : "#999", margin: 0 }}>
            Click or drag to upload  ·  Max 10MB
          </p>
        </Dragger>
      )}
    </div>
  );
};

export default ImageUpload;
