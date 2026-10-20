# App.jsx — Patch 29 Anleitung

Füge in deiner bestehenden `client/src/App.jsx` folgende Änderungen ein:

## 1. Import hinzufügen (bei den anderen lazy-imports)

```jsx
const ModPage = lazy(() => import('./pages/ModPage'));
```

## 2. Route hinzufügen (im Router, nach der AdminPage-Route)

```jsx
<Route
  path="/mod"
  element={
    <ProtectedRoute roles={['moderator', 'admin']}>
      <ModPage />
    </ProtectedRoute>
  }
/>
```

### Falls du kein ProtectedRoute mit roles-Prop hast, alternativ:

```jsx
<Route
  path="/mod"
  element={
    <RequireAuth>
      <RequireModerator>
        <ModPage />
      </RequireModerator>
    </RequireAuth>
  }
/>
```

### Oder die einfachste Variante (prüft intern selbst):

```jsx
<Route path="/mod" element={<ModPage />} />
```

> ModPage selbst prüft bereits `user.role` und leitet weg wenn kein Moderator/Admin.

## 3. Nav-Link (optional, in deiner Navbar/Header-Komponente)

Füge einen Link für Moderatoren hinzu:

```jsx
{(user?.role === 'moderator' || user?.role === 'admin') && (
  <Link to="/mod">Mod Panel</Link>
)}
```
