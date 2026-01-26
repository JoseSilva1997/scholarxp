import './App.css';
import Header from './components/Header';
import Footer from './components/Footer';

export default function App() {
  return (
    <div className="App">
      <Header />
      <main className="App__content">
        <p>Welcome to the Scholar XP Frontend!</p>
      </main>
      <Footer />
    </div>
  );
}
