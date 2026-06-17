import { Brandmark } from "./Brandmark";

export function Footer() {
  return (
    <footer className="site-foot">
      <div className="wrap row">
        <Brandmark href={null} />
        <span className="cp">
          © {new Date().getFullYear()} Vouch · Verified endorsements
        </span>
      </div>
    </footer>
  );
}
