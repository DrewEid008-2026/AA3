import React from 'react';
import { AlertTriangle, RotateCcw, ArrowLeft } from 'lucide-react';

// Catches render errors thrown anywhere inside the Battle tree (including the
// Harvester boss attacks) so a bad runtime data shape shows a recoverable error
// card instead of a blank white screen. Logs the error + stack to the console
// for diagnosis, and offers Restart / Return to Missions.
export default class BattleErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    const { missionId, turn } = this.props;
    console.error('[BattleErrorBoundary] Render error during battle', {
      missionId,
      turn,
      error,
      componentStack: info?.componentStack,
    });
    this.setState({ info });
  }

  handleReset = () => {
    this.setState({ error: null, info: null });
    if (typeof this.props.onRestart === 'function') this.props.onRestart();
  };

  handleExit = () => {
    this.setState({ error: null, info: null });
    if (typeof this.props.onExit === 'function') this.props.onExit();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const message = error?.message || String(error);

    return (
      <div className="flex flex-col items-center justify-center gap-4 h-[100dvh] w-full bg-slate-950 px-6 text-center">
        <AlertTriangle className="w-10 h-10 text-amber-400" />
        <div className="text-rose-400 font-black text-sm tracking-wide uppercase">
          Battle Render Error
        </div>
        <div className="text-slate-400 text-xs max-w-md break-words">
          {message}
        </div>
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={this.handleReset}
            className="flex items-center gap-1.5 px-4 py-2 rounded bg-amber-600 text-white text-sm font-bold"
          >
            <RotateCcw className="w-4 h-4" />
            Restart Battle
          </button>
          <button
            onClick={this.handleExit}
            className="flex items-center gap-1.5 px-4 py-2 rounded bg-slate-800 text-white text-sm font-bold"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Missions
          </button>
        </div>
      </div>
    );
  }
}