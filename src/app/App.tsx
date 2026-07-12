import { ReviewSupplements } from "../supplements/ReviewSupplements";

export function App() {
  if (window.location.pathname === "/review/supplements")
    return <ReviewSupplements />;
  return null;
}
