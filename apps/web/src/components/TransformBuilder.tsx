'use client';

import { useState } from 'react';
import { Plus, Play, Save, X, ArrowRight } from 'lucide-react';

interface TransformStep {
  id: string;
  type: 'api_call' | 'regex' | 'filter' | 'transform';
  config: any;
}

interface CustomTransform {
  id: string;
  name: string;
  description: string;
  inputType: string;
  outputType: string;
  steps: TransformStep[];
}

interface TransformBuilderProps {
  onClose?: () => void;
}

export default function TransformBuilder({ onClose }: TransformBuilderProps) {
  const [transform, setTransform] = useState<CustomTransform>({
    id: '',
    name: '',
    description: '',
    inputType: 'domain',
    outputType: 'ip_address',
    steps: [],
  });

  const stepTypes = [
    { type: 'api_call', label: 'API Call', icon: '🌐' },
    { type: 'regex', label: 'Regex Extract', icon: '🔍' },
    { type: 'filter', label: 'Filter', icon: '⚡' },
    { type: 'transform', label: 'Transform Data', icon: '🔄' },
  ];

  const entityTypes = [
    'domain', 'ip_address', 'email_address', 'person', 'organization',
    'phone_number', 'location', 'url', 'username', 'text'
  ];

  const addStep = (type: string) => {
    const newStep: TransformStep = {
      id: Date.now().toString(),
      type: type as any,
      config: {},
    };
    setTransform({ ...transform, steps: [...transform.steps, newStep] });
  };

  const removeStep = (stepId: string) => {
    setTransform({
      ...transform,
      steps: transform.steps.filter(s => s.id !== stepId),
    });
  };

  const updateStep = (stepId: string, config: any) => {
    setTransform({
      ...transform,
      steps: transform.steps.map(s =>
        s.id === stepId ? { ...s, config } : s
      ),
    });
  };

  const saveTransform = async () => {
    alert('Transform saved successfully! (mock)');
    onClose?.();
  };

  const testTransform = async () => {
    alert('Transform test started! Check console for details.');
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-slate-900 border border-purple-500/20 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-purple-500/20">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <span className="text-3xl">🛠️</span>
                Визуальный Конструктор
              </h2>
              <p className="text-sm text-slate-400 mt-1">Создавайте собственные трансформы без кода</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Название трансформа *
              </label>
              <input
                type="text"
                value={transform.name}
                onChange={(e) => setTransform({ ...transform, name: e.target.value })}
                placeholder="напр., Custom Domain Analyzer"
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Описание
              </label>
              <textarea
                value={transform.description}
                onChange={(e) => setTransform({ ...transform, description: e.target.value })}
                placeholder="Что делает этот трансформ?"
                rows={2}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 resize-none transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Входной тип *
                </label>
                <select
                  value={transform.inputType}
                  onChange={(e) => setTransform({ ...transform, inputType: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
                >
                  {entityTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Выходной тип *
                </label>
                <select
                  value={transform.outputType}
                  onChange={(e) => setTransform({ ...transform, outputType: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
                >
                  {entityTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Шаги трансформации</h3>
              <div className="flex gap-2">
                {stepTypes.map(({ type, label, icon }) => (
                  <button
                    key={type}
                    onClick={() => addStep(type)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition-colors flex items-center gap-2 border border-slate-700 hover:border-purple-500/50"
                    title={`Добавить ${label}`}
                  >
                    <span>{icon}</span>
                    <span>{label}</span>
                    <Plus className="w-3 h-3" />
                  </button>
                ))}
              </div>
            </div>

            {transform.steps.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-700 rounded-lg">
                <p className="text-slate-400">Нет шагов. Добавьте шаги выше, чтобы построить трансформ.</p>
                <p className="text-sm text-slate-500 mt-1">Трансформы выполняются последовательно сверху вниз</p>
              </div>
            ) : (
              <div className="space-y-3">
                {transform.steps.map((step, index) => (
                  <div key={step.id} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                      {index + 1}
                    </div>

                    <div className="flex-1 bg-slate-800 border border-slate-700 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-white capitalize flex items-center gap-2">
                          <span>{stepTypes.find(t => t.type === step.type)?.icon}</span>
                          {step.type.replace('_', ' ')}
                        </span>
                        <button
                          onClick={() => removeStep(step.id)}
                          className="p-1 hover:bg-red-600/20 rounded transition-colors"
                          title="Удалить шаг"
                        >
                          <X className="w-4 h-4 text-red-400" />
                        </button>
                      </div>

                      {step.type === 'api_call' && (
                        <div className="space-y-2">
                          <input
                            type="text"
                            placeholder="API URL (напр., https://api.example.com/lookup)"
                            value={step.config.url || ''}
                            onChange={(e) => updateStep(step.id, { ...step.config, url: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                          />
                          <input
                            type="text"
                            placeholder="Путь к ответу (напр., data.results)"
                            value={step.config.responsePath || ''}
                            onChange={(e) => updateStep(step.id, { ...step.config, responsePath: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                          />
                        </div>
                      )}

                      {step.type === 'regex' && (
                        <input
                          type="text"
                          placeholder="Regex паттерн (напр., \d+\.\d+\.\d+\.\d+)"
                          value={step.config.pattern || ''}
                          onChange={(e) => updateStep(step.id, { ...step.config, pattern: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                        />
                      )}

                      {step.type === 'filter' && (
                        <input
                          type="text"
                          placeholder="Условие фильтра (напр., length > 10)"
                          value={step.config.condition || ''}
                          onChange={(e) => updateStep(step.id, { ...step.config, condition: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                        />
                      )}

                      {step.type === 'transform' && (
                        <select
                          value={step.config.operation || 'uppercase'}
                          onChange={(e) => updateStep(step.id, { ...step.config, operation: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-white focus:outline-none focus:border-purple-500"
                        >
                          <option value="uppercase">ВЕРХНИЙ РЕГИСТР</option>
                          <option value="lowercase">нижний регистр</option>
                          <option value="trim">Обрезать (Trim)</option>
                          <option value="split">Разделить (Split)</option>
                        </select>
                      )}
                    </div>

                    {index < transform.steps.length - 1 && (
                      <ArrowRight className="flex-shrink-0 w-5 h-5 text-purple-500 mt-2" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-purple-500/20 flex items-center justify-between bg-slate-900/50">
          <button
            onClick={testTransform}
            disabled={!transform.name || transform.steps.length === 0}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4" />
            Тест
          </button>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={saveTransform}
              disabled={!transform.name || transform.steps.length === 0}
              className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:opacity-90 rounded-lg text-white flex items-center gap-2 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              <Save className="w-4 h-4" />
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
