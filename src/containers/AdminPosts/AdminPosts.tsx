import React, { useEffect, useState } from "react";
import {
  Container,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Snackbar,
  Alert,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  CircularProgress,
} from "@mui/material";
import { Edit, Delete } from "@mui/icons-material";
import api from "../../api"; // axios instance
import "./AdminPosts.scss";

type Post = {
  _id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  isActive: boolean;
  publishedAt?: string;
};

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    <Container className="admin-posts">
      <Typography variant="h4" gutterBottom>
        Manage Posts
      </Typography>

      <Button variant="contained" color="primary" onClick={() => handleOpen()}>
        Add New Post
      </Button>

      {loading ? (
        <div className="loading"><CircularProgress /></div>
      ) : (
        <Table className="posts-table">
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Message</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Active</TableCell>
              <TableCell>Published At</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {posts.map((post) => (
              <TableRow key={post._id}>
                <TableCell>{post.title}</TableCell>
                <TableCell>{post.message}</TableCell>
                <TableCell>{post.type}</TableCell>
                <TableCell>{post.isActive ? "Yes" : "No"}</TableCell>
                <TableCell>{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : "-"}</TableCell>
                <TableCell align="right">
                  <IconButton color="primary" onClick={() => handleOpen(post)}>
                    <Edit />
                  </IconButton>
                  <IconButton color="error" onClick={() => handleDelete(post._id)}>
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Dialog for Add/Edit */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{editingPost ? "Edit Post" : "Add Post"}</DialogTitle>
        <DialogContent className="dialog-form">
          <TextField
            margin="dense"
            label="Title"
            name="title"
            fullWidth
            value={formData.title || ""}
            onChange={handleChange}
          />
          <TextField
            margin="dense"
            label="Message"
            name="message"
            fullWidth
            multiline
            rows={3}
            value={formData.message || ""}
            onChange={handleChange}
          />
          <TextField
            margin="dense"
            label="Type"
            name="type"
            fullWidth
            placeholder="info, success, warning, error"
            value={formData.type || ""}
            onChange={handleChange}
          />
          <TextField
            margin="dense"
            label="Published At"
            name="publishedAt"
            type="date"
            fullWidth
            InputLabelProps={{ shrink: true }}
            value={formData.publishedAt ? formData.publishedAt.substring(0, 10) : ""}
            onChange={handleChange}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit}>
            {editingPost ? "Update" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar Alert */}
      <Snackbar open={alert.open} autoHideDuration={3000} onClose={() => setAlert({ ...alert, open: false })}>
        <Alert severity={alert.type} sx={{ width: "100%" }}>
          {alert.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default AdminPosts;
