import { useParams, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

// Redirect /category/:slug to /?category=:slug
export default function CategoryPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    navigate(`/?category=${slug}`, { replace: true });
  }, [slug]);
  return null;
}
