import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  OutlinedInput,
  Select,
  Snackbar,
  Alert,
} from "@mui/material";
import { ArrowLeft, Newspaper, Pencil, Plus, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import api from "../../api"; // axios instance
import "../Settings/SettingsCommon.scss";
import "./AdminPosts.scss";

type Post = {
  _id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  isActive: boolean;
  publishedAt?: string;
};

const postTypes: Post["type"][] = ["info", "success", "warning", "error"];

const AdminPosts: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [formData, setFormData] = useState<Partial<Post>>({});
  const [alert, setAlert] = useState<{ open: boolean; message: string; type: "success" | "error" }>({ open: false, message: "", type: "success" });

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const res = await api.get("posts");
      setPosts(res.data.results);
    } catch (err) {
      setAlert({ open: true, message: "Failed to fetch posts", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (post?: Post) => {
    if (post) {
      setEditingPost(post);
      setFormData(post);
    } else {
      setEditingPost(null);
      setFormData({});
    }
    setOpen(true);
  };

  const handleClose = () => setOpen(false);

  const handleChange = (e: { target: { name: string; value: string } }) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    try {
      if (editingPost) {
        await api.update(`posts/${editingPost._id}`, formData);
        setAlert({ open: true, message: "Post updated successfully", type: "success" });
      } else {
        await api.post("posts", formData);
        setAlert({ open: true, message: "Post created successfully", type: "success" });
      }
      fetchPosts();
      handleClose();
    } catch (err) {
      setAlert({ open: true, message: "Error saving post", type: "error" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`posts/${id}`, {});
      setAlert({ open: true, message: "Post deleted successfully", type: "success" });
      fetchPosts();
    } catch (err) {
      setAlert({ open: true, message: "Error deleting post", type: "error" });
    }
  };

  return (
    <div className="settings-page admin-posts">
      <Link to="/settings" className="settings-page__back"><ArrowLeft size={15} /> Back to Settings</Link>
      <div className="settings-page__header">
        <div className="settings-page__title">
          <span className="settings-page__icon"><Newspaper size={20} strokeWidth={2} /></span>
          <div>
            <h1>Posts</h1>
            <p>News and updates published to customers.</p>
          </div>
        </div>
        <button type="button" className="settings-btn settings-btn--primary" onClick={() => handleOpen()}>
          <Plus size={16} />
          New post
        </button>
      </div>

      <section className="settings-panel">
      <div className="settings-panel__body">
        {loading ? (
          <div className="ap-list" aria-busy="true">
            {[0, 1, 2].map((i) => <div key={i} className="settings-skeleton ap-skeleton" />)}
          </div>
        ) : posts.length === 0 ? (
          <div className="settings-empty">
            <strong>No posts yet</strong>
            <p>Use New post to publish your first update.</p>
          </div>
        ) : (
          <ul className="ap-list">
            {posts.map((post) => (
              <li key={post._id} className="ap-post">
                <div className="ap-post__main">
                  <div className="ap-post__title-row">
                    <h3 className="ap-post__title">{post.title}</h3>
                    <span className={`ap-chip ap-chip--${post.type}`}>{post.type}</span>
                    {!post.isActive && <span className="ap-chip ap-chip--inactive">Inactive</span>}
                  </div>
                  <p className="ap-post__message">{post.message}</p>
                  <p className="ap-post__date">
                    {post.publishedAt ? `Published ${new Date(post.publishedAt).toLocaleDateString()}` : "No publish date"}
                  </p>
                </div>
                <div className="ap-post__actions">
                  <button
                    type="button"
                    className="settings-btn settings-btn--icon"
                    aria-label={`Edit ${post.title}`}
                    onClick={() => handleOpen(post)}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    className="settings-btn settings-btn--icon settings-btn--danger"
                    aria-label={`Delete ${post.title}`}
                    onClick={() => handleDelete(post._id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      </section>

      {/* Dialog for Add/Edit */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ className: "ap-dialog" }}>
        <DialogTitle className="ap-dialog__title">{editingPost ? "Edit post" : "New post"}</DialogTitle>
        <DialogContent className="ap-dialog__form">
          <div className="settings-field">
            <label htmlFor="post-title">Title</label>
            <OutlinedInput
              id="post-title"
              name="title"
              size="small"
              value={formData.title || ""}
              onChange={handleChange}
            />
          </div>
          <div className="settings-field">
            <label htmlFor="post-message">Message</label>
            <OutlinedInput
              id="post-message"
              name="message"
              multiline
              minRows={3}
              value={formData.message || ""}
              onChange={handleChange}
            />
          </div>
          <div className="ap-dialog__row">
            <div className="settings-field">
              <label id="post-type-label">Type</label>
              <Select
                labelId="post-type-label"
                name="type"
                size="small"
                displayEmpty
                value={formData.type || ""}
                onChange={(e) => handleChange({ target: { name: "type", value: e.target.value as string } })}
                input={<OutlinedInput />}
              >
                <MenuItem value="" disabled>Choose a type</MenuItem>
                {postTypes.map((type) => (
                  <MenuItem key={type} value={type}>
                    <span className={`ap-chip ap-chip--${type}`}>{type}</span>
                  </MenuItem>
                ))}
              </Select>
            </div>
            <div className="settings-field">
              <label htmlFor="post-published">Published at</label>
              <OutlinedInput
                id="post-published"
                name="publishedAt"
                type="date"
                size="small"
                value={formData.publishedAt ? formData.publishedAt.substring(0, 10) : ""}
                onChange={handleChange}
              />
            </div>
          </div>
        </DialogContent>
        <DialogActions className="ap-dialog__actions">
          <button type="button" className="settings-btn settings-btn--ghost" onClick={handleClose}>Cancel</button>
          <button type="button" className="settings-btn settings-btn--primary" onClick={handleSubmit}>
            {editingPost ? "Save changes" : "Publish"}
          </button>
        </DialogActions>
      </Dialog>

      {/* Snackbar Alert */}
      <Snackbar open={alert.open} autoHideDuration={3000} onClose={() => setAlert({ ...alert, open: false })}>
        <Alert severity={alert.type} sx={{ width: "100%" }}>
          {alert.message}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default AdminPosts;
