import React, { useState, useEffect } from 'react';
import { socket } from '../services/socket';
import { EventType } from '@quizzy/events';
import { Quiz, Game, LeaderboardEntry } from '@quizzy/types';
import { Play, Users, Trophy, ChevronRight, Award, CheckCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const HostView: React.FC = () => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<{ id: string; nickname: string; score: number }[]>([]);
  const [gameState, setGameState] = useState<'SELECT_QUIZ' | 'LOBBY' | 'QUESTION' | 'QUESTION_RESULTS' | 'FINISHED'>('SELECT_QUIZ');

  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [questionEndedData, setQuestionEndedData] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    fetch(`${API_URL}/quizzes`)
      .then(res => res.json())
      .then(data => setQuizzes(data))
      .catch(err => console.error('Error loading quizzes:', err));

    socket.on('event', (event: any) => {
      if (event.type === EventType.PLAYER_JOINED) {
        setPlayers(prev => {
          if (prev.some(p => p.id === event.player.id)) return prev;
          return [...prev, event.player];
        });
      } else if (event.type === EventType.QUESTION_STARTED) {
        setCurrentQuestion(event);
        setGameState('QUESTION');
        setTimeLeft(Math.round(event.durationMs / 1000));
      } else if (event.type === EventType.QUESTION_ENDED) {
        setQuestionEndedData(event);
        setGameState('QUESTION_RESULTS');
      } else if (event.type === EventType.LEADERBOARD_UPDATED) {
        setLeaderboard(event.leaderboard);
      } else if (event.type === EventType.GAME_FINISHED) {
        setLeaderboard(event.finalLeaderboard);
        setGameState('FINISHED');
      }
    });

    return () => {
      socket.off('event');
    };
  }, []);

  useEffect(() => {
    if (gameState === 'QUESTION' && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [gameState, timeLeft]);

  const createAndStartLobby = async (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    const res = await fetch(`${API_URL}/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quizId: quiz.id, hostId: 'host-admin' })
    });
    const newGame = await res.json();
    setGame(newGame);
    socket.emit('join_room', { gameId: newGame.id });
    setGameState('LOBBY');
  };

  const handleStartGame = () => {
    if (game) {
      socket.emit('host_start_game', { gameId: game.id });
    }
  };

  const handleEndQuestionEarly = () => {
    if (game) {
      socket.emit('host_end_question', { gameId: game.id });
    }
  };

  const handleNextQuestion = () => {
    if (game) {
      socket.emit('host_next_question', { gameId: game.id });
    }
  };

  if (gameState === 'SELECT_QUIZ') {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-4xl font-extrabold mb-8 text-center text-yellow-400">
          🎮 Espace Animateur (Host)
        </h1>
        <h2 className="text-2xl font-bold mb-4">Sélectionnez un Quiz pour lancer la partie</h2>

        <div className="grid md:grid-cols-2 gap-6">
          {quizzes.map(quiz => (
            <div
              key={quiz.id}
              className="bg-white/10 backdrop-blur border border-white/20 p-6 rounded-2xl hover:bg-white/20 transition cursor-pointer flex flex-col justify-between"
              onClick={() => createAndStartLobby(quiz)}
            >
              <div>
                <h3 className="text-2xl font-bold text-white mb-2">{quiz.title}</h3>
                <p className="text-gray-300 mb-4">{quiz.description}</p>
                <div className="text-sm text-yellow-300 font-semibold mb-4">
                  {quiz.questions.length} Question(s)
                </div>
              </div>
              <button
                className="w-full bg-quizzy-blue hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5" /> Lancer ce Quiz
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (gameState === 'LOBBY' && game) {
    const playUrl = `${window.location.origin}?pin=${game.pin}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(playUrl)}`;

    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <div className="bg-white/10 backdrop-blur p-8 rounded-3xl border border-white/20 mb-8 shadow-2xl">
          <p className="text-xl uppercase tracking-widest text-gray-300 font-bold mb-2">Rejoignez la partie !</p>
          <div className="bg-white text-quizzy-darkPurple py-4 px-8 rounded-2xl inline-block shadow-lg mb-6">
            <span className="text-2xl font-bold block text-gray-500">PIN DU JEU :</span>
            <span className="text-6xl font-extrabold tracking-wider">{game.pin}</span>
          </div>

          <div className="flex justify-center items-center gap-8 mb-6">
            <div className="bg-white p-3 rounded-xl shadow">
              <img src={qrCodeUrl} alt="QR Code PIN" className="w-40 h-40" />
            </div>
            <div className="text-left">
              <p className="text-lg font-bold mb-1">Scannez pour rejoindre</p>
              <p className="text-sm text-gray-300">ou rdv sur <span className="text-yellow-300 underline font-semibold">{window.location.host}</span></p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-2xl font-bold text-yellow-400 mb-6">
            <Users className="w-8 h-8" /> {players.length} Joueur(s) dans la salle
          </div>

          <div className="flex flex-wrap justify-center gap-3 mb-8 min-h-[100px] p-4 bg-black/20 rounded-xl">
            {players.length === 0 ? (
              <p className="text-gray-400 italic">En attente de connexion des participants...</p>
            ) : (
              players.map(p => (
                <span key={p.id} className="bg-quizzy-purple px-5 py-2 rounded-full font-bold text-lg shadow">
                  {p.nickname}
                </span>
              ))
            )}
          </div>

          <button
            disabled={players.length === 0}
            onClick={handleStartGame}
            className={`w-full py-5 rounded-2xl font-black text-2xl uppercase tracking-wider transition flex items-center justify-center gap-3 ${
              players.length > 0 ? 'bg-quizzy-green hover:bg-green-600 text-white cursor-pointer shadow-lg' : 'bg-gray-600 opacity-50 cursor-not-allowed'
            }`}
          >
            <Play className="w-8 h-8" /> Commencer le jeu
          </button>
        </div>
      </div>
    );
  }

  if (gameState === 'QUESTION' && currentQuestion) {
    const colors = ['bg-quizzy-red', 'bg-quizzy-blue', 'bg-quizzy-yellow', 'bg-quizzy-green'];

    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6 bg-white/10 p-4 rounded-2xl backdrop-blur">
          <span className="text-xl font-bold text-yellow-300">
            Question {currentQuestion.questionIndex + 1} / {currentQuestion.totalQuestions}
          </span>
          <div className="w-16 h-16 rounded-full bg-yellow-400 text-quizzy-darkPurple flex items-center justify-center text-3xl font-extrabold shadow-lg">
            {timeLeft}
          </div>
        </div>

        <div className="bg-white text-gray-900 p-8 rounded-3xl text-center mb-8 shadow-2xl">
          <h2 className="text-3xl font-black">{currentQuestion.text}</h2>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          {currentQuestion.answers.map((ans: any, idx: number) => (
            <div
              key={ans.id}
              className={`${colors[idx % 4]} p-6 rounded-2xl text-white font-bold text-2xl flex items-center gap-4 shadow-lg`}
            >
              <span className="bg-white/20 w-10 h-10 rounded-full flex items-center justify-center font-extrabold">
                {idx + 1}
              </span>
              <span>{ans.text}</span>
            </div>
          ))}
        </div>

        <button
          onClick={handleEndQuestionEarly}
          className="w-full bg-quizzy-purple hover:bg-purple-800 text-white py-4 rounded-2xl font-bold text-xl flex items-center justify-center gap-2 shadow-lg"
        >
          <CheckCircle className="w-6 h-6" /> Afficher les résultats de la question
        </button>
      </div>
    );
  }

  if (gameState === 'QUESTION_RESULTS' && questionEndedData) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white/10 backdrop-blur p-8 rounded-3xl border border-white/20 mb-8 text-center shadow-2xl">
          <h2 className="text-3xl font-extrabold mb-6 text-yellow-300">Résultats de la Question</h2>

          <div className="bg-white text-gray-900 p-6 rounded-2xl mb-6">
            <p className="text-sm text-gray-500 font-bold uppercase">Bonne Réponse :</p>
            <p className="text-2xl font-black text-quizzy-green">
              {currentQuestion?.answers.find((a: any) => a.id === questionEndedData.correctAnswerId)?.text}
            </p>
          </div>

          <h3 className="text-2xl font-bold mb-4 flex items-center justify-center gap-2">
            <Trophy className="w-7 h-7 text-yellow-400" /> Classement Général
          </h3>

          <div className="space-y-3 mb-8">
            {leaderboard.map((entry) => (
              <div
                key={entry.playerId}
                className={`p-4 rounded-2xl flex justify-between items-center font-bold text-xl ${
                  entry.rank === 1 ? 'bg-yellow-400 text-quizzy-darkPurple shadow-lg scale-105' : 'bg-white/10 text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 text-left font-black">#{entry.rank}</span>
                  <span>{entry.nickname}</span>
                </div>
                <span className="font-extrabold">{entry.score} pts</span>
              </div>
            ))}
          </div>

          <button
            onClick={handleNextQuestion}
            className="w-full bg-quizzy-blue hover:bg-blue-600 text-white py-5 rounded-2xl font-black text-2xl uppercase tracking-wider flex items-center justify-center gap-3 shadow-lg"
          >
            Question Suivante <ChevronRight className="w-8 h-8" />
          </button>
        </div>
      </div>
    );
  }

  if (gameState === 'FINISHED') {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <div className="bg-white/10 backdrop-blur p-10 rounded-3xl border border-white/20 shadow-2xl">
          <Award className="w-24 h-24 text-yellow-400 mx-auto mb-4 animate-bounce" />
          <h1 className="text-5xl font-black mb-2 text-yellow-400">PARTIE TERMINÉE !</h1>
          <p className="text-xl text-gray-300 mb-8">Félicitations aux gagnants !</p>

          <div className="space-y-4 mb-8">
            {leaderboard.slice(0, 3).map((entry, idx) => (
              <div
                key={entry.playerId}
                className={`p-6 rounded-2xl font-black text-2xl flex justify-between items-center ${
                  idx === 0 ? 'bg-yellow-400 text-quizzy-darkPurple text-3xl shadow-xl' :
                  idx === 1 ? 'bg-gray-300 text-quizzy-darkPurple shadow-lg' :
                  'bg-amber-600 text-white shadow'
                }`}
              >
                <span>#{idx + 1} {entry.nickname}</span>
                <span>{entry.score} pts</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => setGameState('SELECT_QUIZ')}
            className="w-full bg-quizzy-green hover:bg-green-600 text-white py-4 rounded-2xl font-bold text-xl shadow-lg"
          >
            Revenir au menu des Quiz
          </button>
        </div>
      </div>
    );
  }

  return null;
};
