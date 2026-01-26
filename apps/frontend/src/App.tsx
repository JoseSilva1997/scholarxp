import './App.css';
import Header from './components/Header';
import Footer from './components/Footer';
import Landing from './routes/Landing';

export default function App() {
  return (
    <div className="App">
      <Header />
      <main className="App__content">
        <Landing />
      </main>
      <Footer />
    </div>
  );
}
