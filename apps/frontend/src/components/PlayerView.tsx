import React, { useState, useEffect } from 'react';
import { socket } from '../services/socket';
import { EventType } from '@kahoot/events';
import { AnswerOption } from '@kahoot/types';
import { Check, X, ShieldAlert, Award, Loader } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const PlayerView: React.FC = () => {
  const [pin, setPin] = useState<string>('');
  const [nickname, setNickname] = useState<string>('');
  const [joinedData, setJoinedData] = useState<{ gameId: string; playerId: string } | null>(null);
  const [playerState, setPlayerState] = useState<'LOGIN' | 'WAITING_LOBBY' | 'QUESTION' | 'SUBMITTED' | 'QUESTION_RESULT' | 'FINISHED'>('LOGIN');

  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(null);
  const [lastAnswerResult, setLastAnswerResult] = useState<{ score: number; isCorrect: boolean } | null>(null);
  const [totalScore, setTotalScore] = useState<number>(0);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pinParam = params.get('pin');
    if (pinParam) {
      setPin(pinParam);
    }

    socket.on('event', (event: any) => {
      if (event.type === EventType.QUESTION_STARTED) {
        setCurrentQuestion(event);
        setSelectedAnswerId(null);
        setLastAnswerResult(null);
        setPlayerState('QUESTION');
      } else if (event.type === EventType.QUESTION_ENDED) {
        setPlayerState('QUESTION_RESULT');
      } else if (event.type === EventType.LEADERBOARD_UPDATED) {
        if (joinedData) {
          const entry = event.leaderboard.find((l: any) => l.playerId === joinedData.playerId);
          if (entry) {
            setTotalScore(entry.score);
            setMyRank(entry.rank);
          }
        }
      } else if (event.type === EventType.GAME_FINISHED) {
        if (joinedData) {
          const entry = event.finalLeaderboard.find((l: any) => l.playerId === joinedData.playerId);
          if (entry) {
            setTotalScore(entry.score);
            setMyRank(entry.rank);
          }
        }
        setPlayerState('FINISHED');
      }
    });

    socket.on('answer_result', (result: { score: number; isCorrect: boolean }) => {
      setLastAnswerResult(result);
    });

    socket.on('error', (err: { message: string }) => {
      setErrorMsg(err.message);
    });

    return () => {
      socket.off('event');
      socket.off('answer_result');
      socket.off('error');
    };
  }, [joinedData]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    socket.emit('player_join', { pin, nickname }, (res: any) => {
      if (res && res.success) {
        setJoinedData({ gameId: res.gameId, playerId: res.playerId });
        setPlayerState('WAITING_LOBBY');
      } else {
        setErrorMsg(res?.message || 'Impossible de rejoindre la partie');
      }
    });
  };

  const handleSubmitAnswer = (answerId: string) => {
    if (!joinedData || !currentQuestion || playerState !== 'QUESTION') return;

    setSelectedAnswerId(answerId);
    setPlayerState('SUBMITTED');

    socket.emit('player_submit_answer', {
      gameId: joinedData.gameId,
      playerId: joinedData.playerId,
      questionId: currentQuestion.questionId,
      answerId
    });
  };

  if (playerState === 'LOGIN') {
    return (
      <div className="max-w-md mx-auto p-6 text-center min-h-[80vh] flex flex-col justify-center">
        <div className="bg-white/10 backdrop-blur p-8 rounded-3xl border border-white/20 shadow-2xl">
          <h1 className="text-4xl font-black mb-6 text-yellow-400 tracking-wide">
            KAHOOT!
          </h1>

          {errorMsg && (
            <div className="bg-red-500/80 text-white p-3 rounded-xl mb-4 font-bold flex items-center gap-2 justify-center">
              <ShieldAlert className="w-5 h-5" /> {errorMsg}
            </div>
          )}

          <form onSubmit={handleJoin} className="space-y-4">
            <input
              type="text"
              placeholder="PIN du jeu"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full py-4 px-6 rounded-2xl bg-white text-gray-900 font-extrabold text-center text-2xl placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-yellow-400 shadow"
              required
            />
            <input
              type="text"
              placeholder="Pseudo"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full py-4 px-6 rounded-2xl bg-white text-gray-900 font-extrabold text-center text-2xl placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-yellow-400 shadow"
              maxLength={15}
              required
            />
            <button
              type="submit"
              className="w-full bg-kahoot-green hover:bg-green-600 text-white py-4 rounded-2xl font-black text-2xl uppercase tracking-wider shadow-lg transition"
            >
              Valider
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (playerState === 'WAITING_LOBBY') {
    return (
      <div className="max-w-md mx-auto p-6 text-center min-h-[80vh] flex flex-col justify-center">
        <div className="bg-white/10 backdrop-blur p-8 rounded-3xl border border-white/20 shadow-2xl">
          <Loader className="w-16 h-16 text-yellow-400 animate-spin mx-auto mb-4" />
          <h2 className="text-3xl font-black mb-2 text-white">Vous êtes connecté !</h2>
          <p className="text-lg text-gray-300 font-bold mb-4">Bienvenue <span className="text-yellow-300">{nickname}</span></p>
          <p className="text-sm text-gray-400">Regardez l'écran de l'animateur pour le lancement...</p>
        </div>
      </div>
    );
  }

  if (playerState === 'QUESTION' && currentQuestion) {
    const colorStyles = [
      'bg-kahoot-red hover:brightness-110',
      'bg-kahoot-blue hover:brightness-110',
      'bg-kahoot-yellow hover:brightness-110',
      'bg-kahoot-green hover:brightness-110'
    ];

    return (
      <div className="max-w-md mx-auto p-4 min-h-[85vh] flex flex-col justify-between">
        <div className="text-center my-2">
          <span className="bg-white/20 px-4 py-2 rounded-full font-bold text-sm text-yellow-300">
            Question {currentQuestion.questionIndex + 1}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 my-auto h-96">
          {currentQuestion.answers.map((ans: AnswerOption, idx: number) => (
            <button
              key={ans.id}
              onClick={() => handleSubmitAnswer(ans.id)}
              className={`${colorStyles[idx % 4]} rounded-2xl font-black text-2xl text-white flex flex-col items-center justify-center p-4 shadow-xl active:scale-95 transition`}
            >
              <span className="text-4xl mb-2">●</span>
              <span>{ans.text}</span>
            </button>
          ))}
        </div>

        <div className="text-center text-sm font-bold text-gray-300">
          Choisissez vite la bonne couleur !
        </div>
      </div>
    );
  }

  if (playerState === 'SUBMITTED') {
    return (
      <div className="max-w-md mx-auto p-6 text-center min-h-[80vh] flex flex-col justify-center">
        <div className="bg-white/10 backdrop-blur p-8 rounded-3xl border border-white/20 shadow-2xl">
          <div className="bg-yellow-400 text-kahoot-darkPurple w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 font-black text-4xl shadow-lg">
            ✓
          </div>
          <h2 className="text-3xl font-black mb-2 text-white">Réponse enregistrée !</h2>
          <p className="text-gray-300 font-bold">En attente de la fin du compte à rebours...</p>
        </div>
      </div>
    );
  }

  if (playerState === 'QUESTION_RESULT') {
    return (
      <div className="max-w-md mx-auto p-6 text-center min-h-[80vh] flex flex-col justify-center">
        <div className={`p-8 rounded-3xl border shadow-2xl backdrop-blur ${
          lastAnswerResult?.isCorrect ? 'bg-green-600/30 border-green-400' : 'bg-red-600/30 border-red-400'
        }`}>
          {lastAnswerResult?.isCorrect ? (
            <>
              <Check className="w-20 h-20 text-green-400 mx-auto mb-4 animate-bounce" />
              <h2 className="text-4xl font-black text-green-400 mb-2">Excellente réponse !</h2>
              <p className="text-2xl font-bold text-white mb-6">+{lastAnswerResult.score} points</p>
            </>
          ) : (
            <>
              <X className="w-20 h-20 text-red-400 mx-auto mb-4" />
              <h2 className="text-4xl font-black text-red-400 mb-2">Mauvaise réponse !</h2>
              <p className="text-lg text-gray-300 mb-6">Pas de points cette fois-ci</p>
            </>
          )}

          <div className="bg-black/30 p-4 rounded-2xl flex justify-between items-center text-lg font-bold">
            <span>Score Total :</span>
            <span className="text-yellow-400 text-2xl font-extrabold">{totalScore} pts</span>
          </div>
          {myRank && (
            <div className="mt-3 text-sm text-gray-300 font-semibold">
              Votre Rang : #{myRank}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (playerState === 'FINISHED') {
    return (
      <div className="max-w-md mx-auto p-6 text-center min-h-[80vh] flex flex-col justify-center">
        <div className="bg-white/10 backdrop-blur p-8 rounded-3xl border border-white/20 shadow-2xl">
          <Award className="w-20 h-20 text-yellow-400 mx-auto mb-4" />
          <h1 className="text-4xl font-black text-yellow-400 mb-2">FIN DU QUIZ</h1>
          <p className="text-xl text-white font-bold mb-6">{nickname}</p>

          <div className="bg-white text-kahoot-darkPurple p-6 rounded-2xl mb-4 font-black">
            <p className="text-sm uppercase text-gray-500">Score Final</p>
            <p className="text-4xl text-kahoot-purple">{totalScore} pts</p>
            {myRank && <p className="text-lg text-yellow-600 mt-1">Rang #{myRank}</p>}
          </div>

          <button
            onClick={() => {
              setPlayerState('LOGIN');
              setJoinedData(null);
            }}
            className="w-full bg-kahoot-blue hover:bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg"
          >
            Rejoindre une autre partie
          </button>
        </div>
      </div>
    );
  }

  return null;
};
