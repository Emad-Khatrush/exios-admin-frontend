
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom'
import api from '../../api';

const AllowToAccessApp = (props: any) => {
  const history = useNavigate();

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) {
      window.location.href = 'https://www.exioslibya.com';
    }
    
    api.post('verifyToken', { token: props.session?.token })
      .then(() => {
        history(`/invoice/${id}/edit`)
      })
      .catch(error => {
        window.location.href = 'https://www.exioslibya.com';
      })
  }, [])

  return (
    <div>Loading...</div>
  );
}

export default AllowToAccessApp;
