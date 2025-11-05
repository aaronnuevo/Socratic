import './globals.css';
import Nav from './nav';
import { SelectedFilesProvider } from './selected-files-context';

export default function RootLayout({ children }) {
  const projectName = process.env.PROJECT_NAME || 'Socratic Project';
  
  return (
    <html lang="en">
      <body>
        <SelectedFilesProvider>
          <div className="app">
            <div className="topbar">{projectName}</div>
            <div className="content">
              <aside className="sidebar">
                <Nav />
              </aside>
              <main className="main">{children}</main>
            </div>
          </div>
        </SelectedFilesProvider>
      </body>
    </html>
  );
}


