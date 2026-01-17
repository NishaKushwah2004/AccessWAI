// frontend/src/pages/Analysis.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Analysis = () => {
  const { id } = useParams();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState('all');

  useEffect(() => {
    fetchAnalysis();
  }, [id]);

  const fetchAnalysis = async () => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
      const response = await fetch(`${API_BASE_URL}/api/analysis/${id}`, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch analysis');
      }

      setAnalysis(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity) => {
    const colors = {
      critical: 'bg-red-100 text-red-800 border-red-200',
      high: 'bg-orange-100 text-orange-800 border-orange-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      low: 'bg-blue-100 text-blue-800 border-blue-200'
    };
    return colors[severity] || colors.low;
  };

  const getScoreColor = (score) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    if (score >= 50) return 'text-orange-600';
    return 'text-red-600';
  };

  const filteredIssues = selectedSeverity === 'all'
    ? analysis?.issues
    : analysis?.issues.filter(i => i.severity === selectedSeverity);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button onClick={() => navigate('/dashboard')} className="text-blue-600 hover:underline">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center text-gray-600 hover:text-gray-900"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <button onClick={logout} className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Project Header */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{analysis.projectName}</h1>
          <p className="text-gray-600">
            Analyzed {analysis.filesAnalyzed} files • {new Date(analysis.createdAt).toLocaleDateString()}
          </p>
        </div>

        {/* Score Card */}
        <div className="bg-linear-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg p-8 mb-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold mb-2">Accessibility Score</h2>
              <p className="text-blue-100">Based on WCAG 2.1 guidelines</p>
            </div>
            <div className="text-right">
              <div className={`text-6xl font-bold ${getScoreColor(analysis.accessibilityScore)} bg-white px-6 py-4 rounded-lg`}>
                {analysis.accessibilityScore}
              </div>
              <p className="text-sm mt-2">out of 100</p>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-red-500">
            <div className="text-3xl font-bold text-gray-900">{analysis.summary.critical}</div>
            <div className="text-sm text-gray-600 mt-1">Critical Issues</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-orange-500">
            <div className="text-3xl font-bold text-gray-900">{analysis.summary.high}</div>
            <div className="text-sm text-gray-600 mt-1">High Priority</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-yellow-500">
            <div className="text-3xl font-bold text-gray-900">{analysis.summary.medium}</div>
            <div className="text-sm text-gray-600 mt-1">Medium Priority</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
            <div className="text-3xl font-bold text-gray-900">{analysis.summary.low}</div>
            <div className="text-sm text-gray-600 mt-1">Low Priority</div>
          </div>
        </div>

        {/* AI Suggestions */}
        {analysis.aiSuggestions && (
          <div className="bg-linear-to-r from-purple-50 to-pink-50 rounded-xl shadow-sm p-6 mb-6 border border-purple-200">
            <div className="flex items-start">
              <div className="flex shrink-0">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div className="ml-4 flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">AI-Powered Recommendations</h3>
                <div className="text-gray-700 whitespace-pre-line">{analysis.aiSuggestions}</div>
              </div>
            </div>
          </div>
        )}

        {/* Issues Filter */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedSeverity('all')}
              className={`px-4 py-2 rounded-lg font-medium transition ${selectedSeverity === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              All Issues ({analysis.issues.length})
            </button>
            <button
              onClick={() => setSelectedSeverity('critical')}
              className={`px-4 py-2 rounded-lg font-medium transition ${selectedSeverity === 'critical' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700 hover:bg-red-200'
                }`}
            >
              Critical ({analysis.summary.critical})
            </button>
            <button
              onClick={() => setSelectedSeverity('high')}
              className={`px-4 py-2 rounded-lg font-medium transition ${selectedSeverity === 'high' ? 'bg-orange-600 text-white' : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                }`}
            >
              High ({analysis.summary.high})
            </button>
            <button
              onClick={() => setSelectedSeverity('medium')}
              className={`px-4 py-2 rounded-lg font-medium transition ${selectedSeverity === 'medium' ? 'bg-yellow-600 text-white' : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                }`}
            >
              Medium ({analysis.summary.medium})
            </button>
            <button
              onClick={() => setSelectedSeverity('low')}
              className={`px-4 py-2 rounded-lg font-medium transition ${selectedSeverity === 'low' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                }`}
            >
              Low ({analysis.summary.low})
            </button>
          </div>
        </div>

        {/* Issues List */}
        <div className="space-y-4">
          {filteredIssues?.map((issue, index) => (
            <div key={index} className="bg-white rounded-lg shadow-sm p-6 border-l-4" style={{
              borderLeftColor: issue.severity === 'critical' ? '#DC2626' :
                issue.severity === 'high' ? '#EA580C' :
                  issue.severity === 'medium' ? '#D97706' : '#2563EB'
            }}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getSeverityColor(issue.severity)}`}>
                    {issue.severity.toUpperCase()}
                  </span>
                  <h3 className="text-lg font-semibold text-gray-900">{issue.type}</h3>
                </div>
                <span className="text-sm text-gray-500">{issue.file}:{issue.line}</span>
              </div>

              <p className="text-gray-700 mb-3">{issue.description}</p>

              <div className="bg-gray-50 rounded-lg p-4 mb-3">
                <p className="text-sm font-medium text-gray-700 mb-2">Code:</p>
                <code className="text-sm text-gray-900 block overflow-x-auto">{issue.code}</code>
              </div>

              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <p className="text-sm font-medium text-green-900 mb-1">💡 How to fix:</p>
                <p className="text-sm text-green-800">{issue.suggestion}</p>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Analysis;