import React, { useEffect, useState } from 'react';
import '../index.css';

interface PreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPreferencesSaved?: (preferences: PreferencesData) => void;
  currentProject?: string | null;
}

export interface PreferencesData {
  latex_models_directory: string;
  latex_models_path: string;
  projects_directory: string;
  projects_directory_path: string;
  limit_mse: number;
  limit_sensitivity: number;
  capture_dpi: number;
  notify_preparation: boolean;
  notify_data_capture: boolean;
  notify_grading: boolean;
  notify_annotation: boolean;
  scan_bw_threshold: number;
  scan_ignore_red: boolean;
  name_field_type: 'image' | 'barcode';
  marks_size_max_increase: number;
  marks_size_max_decrease: number;
  default_darkness_threshold: number;
  default_upper_darkness_threshold: number;
  process_scans_with_three_corner_marks: boolean;
  measured_box_proportion: number;
  minimal_mark: number;
  build_catalog: boolean;
  build_individual_solution: boolean;
  maximal_mark: number;
  mark_grain: number;
  rounding_type: 'rounding' | 'ceiling' | 'floor';
  show_anonymization: boolean;
  anonymous_id_model: string;
  header_annotations: string;
  email_sender: string;
  email_cc: string;
  email_bcc: string;
  email_delay: number;
  email_smtp_host: string;
  email_smtp_port: number;
  email_smtp_ssl: 'None' | 'SSL' | 'STARTTLS';
  email_smtp_user: string;
  email_smtp_password: string;
  df_subjectemail_email_subject: string;
  df_subjectemail_email_text: string;
  df_annotatedemail_email_subject: string;
  df_annotatedemail_email_text: string;
}

export interface ProjectPreferencesData {
  seuil: number;
  seuil_up: number;
  name_field_type: string;
  note_null: string;
  note_min: string;
  note_max: string;
  note_max_plafond: boolean;
  note_grain: string;
  note_arrondi: string;
  verdict: string;
  annote_rtl: boolean;
  annote_position: string;
  verdict_q: string;
  verdict_qc: string;
  nom_examen: string;
  code_examen: string;
}

const defaultPreferences: PreferencesData = {
  latex_models_directory: 'Models', latex_models_path: '',
  projects_directory: 'MC-Projects', projects_directory_path: '',
  limit_mse: 3, limit_sensitivity: 8, capture_dpi: 150,
  notify_preparation: false, notify_data_capture: true,
  notify_grading: true, notify_annotation: true,
  scan_bw_threshold: 0.60, scan_ignore_red: true, name_field_type: 'image',
  marks_size_max_increase: 0.20, marks_size_max_decrease: 0.20,
  default_darkness_threshold: 0.15, default_upper_darkness_threshold: 1.00,
  process_scans_with_three_corner_marks: true,
  measured_box_proportion: 0.80,
  minimal_mark: 0, maximal_mark: 20, mark_grain: 0.5, rounding_type: 'rounding',
  build_catalog: true, build_individual_solution: true,
  show_anonymization: false, anonymous_id_model: 'edddds', header_annotations: '%(aID)',
  email_sender: '', email_cc: '', email_bcc: '', email_delay: 0.0,
  email_smtp_host: 'smtp.gmail.com', email_smtp_port: 465, email_smtp_ssl: 'SSL',
  email_smtp_user: '', email_smtp_password: '',
  df_subjectemail_email_subject: 'Exam question',
  df_subjectemail_email_text: 'Please find enclosed your question sheet.\nRegards.',
  df_annotatedemail_email_subject: 'Exam result',
  df_annotatedemail_email_text: 'Please find enclosed your annotated completed answer sheet.\nRegards.',
};

const defaultProjectPreferences: ProjectPreferencesData = {
  seuil: 0.15,
  seuil_up: 1.00,
  name_field_type: 'image',
  note_null: '0',
  note_min: '',
  note_max: '20',
  note_max_plafond: true,
  note_grain: '0.5',
  note_arrondi: 'rounding',
  verdict: '%(aID)',
  annote_rtl: false,
  annote_position: 'marges',
  verdict_q: '"%s/%m"',
  verdict_qc: '"X"',
  nom_examen: '',
  code_examen: '',
};

const tabs = ['Main', 'Features', 'Display', 'Scan', 'Marking', 'Annotation', 'Email', 'Project'];

export const PreferencesModal: React.FC<PreferencesModalProps> = ({
  isOpen,
  onClose,
  onPreferencesSaved,
  currentProject,
}) => {
  const [activeTab, setActiveTab] = useState('Main');
  const [preferences, setPreferences] = useState<PreferencesData>(defaultPreferences);
  const [initialPreferences, setInitialPreferences] = useState<PreferencesData>(defaultPreferences);
  const [projectPrefs, setProjectPrefs] = useState<ProjectPreferencesData>(defaultProjectPreferences);
  const [initialProjectPrefs, setInitialProjectPrefs] = useState<ProjectPreferencesData>(defaultProjectPreferences);
  const [overriddenKeys, setOverriddenKeys] = useState<string[]>([]);

  const [projectDirectory, setProjectDirectory] = useState('MC-Projects');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestEmail = async () => {
    setIsTestingEmail(true);
    setTestEmailResult(null);
    try {
      const response = await fetch('http://localhost:8000/api/projects/preferences/test_email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: testRecipient.trim() || undefined,
          smtp_host: preferences.email_smtp_host,
          smtp_port: preferences.email_smtp_port,
          smtp_ssl: preferences.email_smtp_ssl,
          smtp_user: preferences.email_smtp_user,
          smtp_password: preferences.email_smtp_password,
          sender: preferences.email_sender,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to send test email.');
      }
      setTestEmailResult({ success: true, message: data.message || 'SMTP test successful!' });
    } catch (err) {
      setTestEmailResult({ success: false, message: err instanceof Error ? err.message : 'Failed to connect.' });
    } finally {
      setIsTestingEmail(false);
    }
  };

  const applyPreferences = (data: Partial<PreferencesData>) => {
    setPreferences((current) => {
      const updated = { ...current, ...data };
      onPreferencesSaved?.(updated);
      setProjectPrefs((curProj) => {
        const next = { ...curProj };
        if (!overriddenKeys.includes('seuil') && updated.default_darkness_threshold !== undefined) {
          next.seuil = updated.default_darkness_threshold;
        }
        if (!overriddenKeys.includes('seuil_up') && updated.default_upper_darkness_threshold !== undefined) {
          next.seuil_up = updated.default_upper_darkness_threshold;
        }
        if (!overriddenKeys.includes('name_field_type') && updated.name_field_type !== undefined) {
          next.name_field_type = updated.name_field_type;
        }
        if (!overriddenKeys.includes('note_null') && updated.minimal_mark !== undefined) {
          next.note_null = String(updated.minimal_mark);
        }
        if (!overriddenKeys.includes('note_max') && updated.maximal_mark !== undefined) {
          next.note_max = String(updated.maximal_mark);
        }
        if (!overriddenKeys.includes('note_grain') && updated.mark_grain !== undefined) {
          next.note_grain = String(updated.mark_grain);
        }
        if (!overriddenKeys.includes('note_arrondi') && updated.rounding_type !== undefined) {
          next.note_arrondi = updated.rounding_type;
        }
        if (!overriddenKeys.includes('verdict') && updated.header_annotations !== undefined) {
          next.verdict = updated.header_annotations;
        }
        return next;
      });
      return updated;
    });
  };

  const loadProjectPreferences = (globalPrefs: PreferencesData = preferences) => {
    if (!currentProject) return;
    fetch(`http://localhost:8000/api/projects/${encodeURIComponent(currentProject)}/preferences`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load project preferences.');
        return response.json();
      })
      .then((data: ProjectPreferencesData & { _overridden?: string[] }) => {
        const ov = data._overridden || [];
        setOverriddenKeys(ov);
        const loaded: ProjectPreferencesData = {
          seuil: Number(data.seuil ?? globalPrefs.default_darkness_threshold ?? 0.15),
          seuil_up: Number(data.seuil_up ?? globalPrefs.default_upper_darkness_threshold ?? 1.00),
          name_field_type: String(data.name_field_type || globalPrefs.name_field_type || 'image'),
          note_null: String(data.note_null ?? globalPrefs.minimal_mark ?? '0'),
          note_min: String(data.note_min ?? ''),
          note_max: String(data.note_max ?? globalPrefs.maximal_mark ?? '20'),
          note_max_plafond: Boolean(data.note_max_plafond ?? true),
          note_grain: String(data.note_grain ?? globalPrefs.mark_grain ?? '0.5'),
          note_arrondi: String(data.note_arrondi || globalPrefs.rounding_type || 'rounding'),
          verdict: String(data.verdict ?? globalPrefs.header_annotations ?? '%(aID)'),
          annote_rtl: Boolean(data.annote_rtl ?? false),
          annote_position: String(data.annote_position || 'marges'),
          verdict_q: String(data.verdict_q ?? '"%s/%m"'),
          verdict_qc: String(data.verdict_qc ?? '"X"'),
          nom_examen: String(data.nom_examen ?? ''),
          code_examen: String(data.code_examen || currentProject),
        };
        setProjectPrefs(loaded);
        setInitialProjectPrefs(loaded);
      })
      .catch((err) => console.error(err));
  };

  const loadGlobalPreferences = () => {
    fetch('http://localhost:8000/api/projects/preferences')
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.json()).detail || 'Unable to load preferences.');
        return response.json();
      })
      .then((data: PreferencesData) => {
        applyPreferences(data);
        setInitialPreferences(data);
        setProjectDirectory(data.projects_directory || 'MC-Projects');
        if (currentProject) {
          loadProjectPreferences(data);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load preferences.'));
  };

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    loadGlobalPreferences();
  }, [isOpen, currentProject]);

  const savePreferences = async (changes: Record<string, string | number | boolean>) => {
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:8000/api/projects/preferences', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(changes),
      });
      if (!response.ok) throw new Error((await response.json()).detail || 'Unable to save preferences.');
      const data = await response.json() as PreferencesData;
      applyPreferences(data);
      setProjectDirectory(data.projects_directory);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save preferences.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateProjectPref = (key: keyof ProjectPreferencesData, value: any) => {
    const updated = { ...projectPrefs, [key]: value };
    setProjectPrefs(updated);
    setOverriddenKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
    if (!currentProject) return;
    // Persist to backend immediately
    fetch(`http://localhost:8000/api/projects/${encodeURIComponent(currentProject)}/preferences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    }).catch((err) => console.error('Error saving project preference:', err));
  };

  const handleUndo = async () => {
    if (activeTab === 'Project') {
      if (currentProject) {
        setProjectPrefs(initialProjectPrefs);
        try {
          await fetch(`http://localhost:8000/api/projects/${encodeURIComponent(currentProject)}/preferences`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(initialProjectPrefs),
          });
        } catch (err) {
          console.error(err);
        }
      }
    } else {
      setPreferences(initialPreferences);
      try {
        await fetch('http://localhost:8000/api/projects/preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(initialPreferences),
        });
        onPreferencesSaved?.(initialPreferences);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleOk = () => {
    onClose();
  };

  const chooseProjectDirectory = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:8000/api/projects/preferences/select_projects_directory', { method: 'POST' });
      if (response.ok) {
        const data = await response.json() as PreferencesData;
        applyPreferences(data);
        setProjectDirectory(data.projects_directory);
        return;
      }
      const detail = (await response.json()).detail || 'Native folder picker is not available.';
      const typed = window.prompt(`${detail}\nEnter a projects directory path that the backend can access:`, projectDirectory);
      if (typed?.trim()) await savePreferences({ projects_directory: typed.trim() });
    } catch (err) {
      const typed = window.prompt('Enter a projects directory path that the backend can access:', projectDirectory);
      if (typed?.trim()) await savePreferences({ projects_directory: typed.trim() });
      else setError(err instanceof Error ? err.message : 'Unable to choose directory.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateNumber = (field: 'limit_mse' | 'limit_sensitivity' | 'capture_dpi' | 'scan_bw_threshold' | 'marks_size_max_increase' | 'marks_size_max_decrease' | 'default_darkness_threshold' | 'default_upper_darkness_threshold' | 'measured_box_proportion' | 'minimal_mark' | 'maximal_mark', value: string) => {
    const numericValue = Number(value);
    const permitsZero = field === 'minimal_mark';
    if (!Number.isFinite(numericValue) || numericValue < 0 || (!permitsZero && numericValue === 0)) {
      setError(permitsZero ? 'Enter a value of zero or greater.' : 'Enter a value greater than zero.');
      return;
    }
    void savePreferences({ [field]: field === 'capture_dpi' ? Math.round(numericValue) : numericValue });
  };

  const renderMain = () => (
    <div className="preferences-tab-body">
      <div className="preferences-section-title">Directories</div>
      <div className="preferences-grid compact">
        <label>LaTeX models directory</label>
        <button className="preferences-combo" disabled title={preferences.latex_models_path}>
          <span className="preferences-folder-icon" /><span>{preferences.latex_models_directory}</span><span className="preferences-chevron">v</span>
        </button>
        <label>Projects directory</label>
        <button className="preferences-combo" onClick={chooseProjectDirectory} disabled={isSaving} title={preferences.projects_directory_path}>
          <span className="preferences-folder-icon" /><span>{projectDirectory}</span><span className="preferences-chevron">v</span>
        </button>
      </div>
    </div>
  );

  const renderFeatures = () => (
    <div className="preferences-tab-body">
      <div className="preferences-section-title">Optional working documents to build</div>
      <label className="preferences-check">
        <input
          type="checkbox"
          checked={preferences.build_individual_solution}
          onChange={(event) => void savePreferences({ build_individual_solution: event.target.checked })}
        />
        <span>Individual solution</span>
      </label>
      <label className="preferences-check" style={{ marginBottom: 16 }}>
        <input
          type="checkbox"
          checked={preferences.build_catalog}
          onChange={(event) => void savePreferences({ build_catalog: event.target.checked })}
        />
        <span>Catalog</span>
      </label>
      
      <div className="preferences-section-title">Anonymization</div>
      <label className="preferences-check">
        <input
          type="checkbox"
          checked={preferences.show_anonymization}
          onChange={(event) => void savePreferences({ show_anonymization: event.target.checked })}
        />
        <span>Display anonymization panel</span>
      </label>
      {preferences.show_anonymization && (
        <div className="preferences-grid anonymization">
          <label>Anonymous ID model</label>
          <input
            value={preferences.anonymous_id_model}
            onChange={(event) => applyPreferences({ anonymous_id_model: event.target.value })}
            onBlur={(event) => void savePreferences({ anonymous_id_model: event.target.value })}
          />
          <label>Header annotations</label>
          <input
            value={preferences.header_annotations}
            onChange={(event) => applyPreferences({ header_annotations: event.target.value })}
            onBlur={(event) => void savePreferences({ header_annotations: event.target.value })}
          />
        </div>
      )}
    </div>
  );

  const renderDisplay = () => (
    <div className="preferences-tab-body">
      <div className="preferences-section-title">Colouring thresholds</div>
      <div className="preferences-grid display-grid">
        <label htmlFor="limit-mse">Limit MSE</label>
        <input id="limit-mse" type="number" min="0.01" step="0.1" defaultValue={preferences.limit_mse} onBlur={(event) => updateNumber('limit_mse', event.target.value)} />
        <label htmlFor="limit-sensitivity">Limit sensitivity</label>
        <input id="limit-sensitivity" type="number" min="0.01" step="0.1" defaultValue={preferences.limit_sensitivity} onBlur={(event) => updateNumber('limit_sensitivity', event.target.value)} />
      </div>

      <div className="preferences-section-title preferences-section-spaced">Miscellaneous</div>
      <div className="preferences-grid display-grid">
        <label htmlFor="capture-dpi">Manual capture density (DPI)</label>
        <input id="capture-dpi" type="number" min="1" step="1" defaultValue={preferences.capture_dpi} onBlur={(event) => updateNumber('capture_dpi', event.target.value)} />
      </div>

      <div className="preferences-section-title preferences-section-spaced">Notifications</div>
      <div style={{ fontStyle: 'italic', fontSize: '13px', color: '#555', marginBottom: '8px' }}>
        Notify the user at the end of the following actions:
      </div>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <label className="preferences-check" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={preferences.notify_preparation}
            onChange={(e) => void savePreferences({ notify_preparation: e.target.checked })}
          />
          <span>Documents update</span>
        </label>
        <label className="preferences-check" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={preferences.notify_data_capture}
            onChange={(e) => void savePreferences({ notify_data_capture: e.target.checked })}
          />
          <span>Data capture</span>
        </label>
        <label className="preferences-check" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={preferences.notify_grading}
            onChange={(e) => void savePreferences({ notify_grading: e.target.checked })}
          />
          <span>Grading</span>
        </label>
        <label className="preferences-check" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={preferences.notify_annotation}
            onChange={(e) => void savePreferences({ notify_annotation: e.target.checked })}
          />
          <span>Annotation</span>
        </label>
      </div>
    </div>
  );

  const renderScan = () => (
    <div className="preferences-tab-body">
      <div className="preferences-section-title">Vector scan conversion</div>
      <div className="preferences-grid display-grid">
        <label htmlFor="scan-bw-threshold">Black and white conversion threshold</label>
        <input id="scan-bw-threshold" type="number" min="0.01" max="1" step="0.01" defaultValue={preferences.scan_bw_threshold} onBlur={(event) => updateNumber('scan_bw_threshold', event.target.value)} />
        <label htmlFor="scan-ignore-red">Ignore red colour</label>
        <input id="scan-ignore-red" type="checkbox" checked={preferences.scan_ignore_red} onChange={(event) => void savePreferences({ scan_ignore_red: event.target.checked })} />
      </div>

      <div className="preferences-section-title preferences-section-spaced">Detection parameters</div>
      <div className="preferences-grid display-grid">
        <label htmlFor="marks-max-increase">Marks size max increase</label>
        <input id="marks-max-increase" type="number" min="0.01" step="0.01" defaultValue={preferences.marks_size_max_increase} onBlur={(event) => updateNumber('marks_size_max_increase', event.target.value)} />
        <label htmlFor="marks-max-decrease">Marks size max decrease</label>
        <input id="marks-max-decrease" type="number" min="0.01" step="0.01" defaultValue={preferences.marks_size_max_decrease} onBlur={(event) => updateNumber('marks_size_max_decrease', event.target.value)} />
        <label htmlFor="darkness-threshold">Default darkness threshold</label>
        <input id="darkness-threshold" type="number" min="0.01" max="1" step="0.01" defaultValue={preferences.default_darkness_threshold} onBlur={(event) => updateNumber('default_darkness_threshold', event.target.value)} />
        <label htmlFor="upper-darkness-threshold">Default upper darkness threshold</label>
        <input id="upper-darkness-threshold" type="number" min="0.01" max="1" step="0.01" defaultValue={preferences.default_upper_darkness_threshold} onBlur={(event) => updateNumber('default_upper_darkness_threshold', event.target.value)} />
        <label htmlFor="scan-name-field-type">Name field type</label>
        <select
          id="scan-name-field-type"
          value={preferences.name_field_type}
          onChange={(e) => void savePreferences({ name_field_type: e.target.value })}
        >
          <option value="image">Image</option>
          <option value="none">None</option>
          <option value="barcode">Barcode</option>
        </select>
        <label htmlFor="measured-box-proportion">Measured box proportion</label>
        <input id="measured-box-proportion" type="number" min="0.01" max="1" step="0.01" defaultValue={preferences.measured_box_proportion} onBlur={(event) => updateNumber('measured_box_proportion', event.target.value)} />
        <label htmlFor="three-corner-marks">Process scans with 3 corner marks</label>
        <input id="three-corner-marks" type="checkbox" checked={preferences.process_scans_with_three_corner_marks} onChange={(event) => void savePreferences({ process_scans_with_three_corner_marks: event.target.checked })} />
      </div>
    </div>
  );

  const renderMarking = () => (
    <div className="preferences-tab-body">
      <div className="preferences-section-title">Default marking options</div>
      <div className="preferences-grid display-grid">
        <label htmlFor="minimal-mark">Minimal mark</label>
        <input id="minimal-mark" type="number" step="0.5" defaultValue={preferences.minimal_mark} onBlur={(event) => updateNumber('minimal_mark', event.target.value)} />
        <label htmlFor="maximal-mark">Maximal mark</label>
        <input id="maximal-mark" type="number" min="0.5" step="0.5" defaultValue={preferences.maximal_mark} onBlur={(event) => updateNumber('maximal_mark', event.target.value)} />
        <label htmlFor="mark-grain">Grain</label>
        <input id="mark-grain" type="number" value="0.5" disabled title="The marking grain is fixed at 0.5." />
        <label htmlFor="rounding-type">Rounding type</label>
        <select id="rounding-type" value={preferences.rounding_type} onChange={(event) => void savePreferences({ rounding_type: event.target.value })}>
          <option value="rounding">rounding</option>
          <option value="ceiling">ceiling</option>
          <option value="floor">floor</option>
        </select>
      </div>
      <div className="preferences-setting-note">For ordinary questions, the selected scale and rounding are applied during marking. A scoring strategy explicitly defined in the LaTeX subject takes priority.</div>
    </div>
  );

  const renderAnnotation = () => (
    <div className="preferences-tab-body">
      <div className="preferences-section-title">Default papers annotation options</div>
      <div style={{ textAlign: 'center', margin: '8px 0 4px', fontStyle: 'italic', fontSize: '13px', color: '#555' }}>
        Default header text
      </div>
      <div style={{ margin: '0 0 10px' }}>
        <textarea
          className="preferences-email-textarea"
          rows={3}
          defaultValue={preferences.header_annotations}
          onBlur={(e) => void savePreferences({ header_annotations: e.target.value })}
          style={{ width: '100%', fontFamily: 'monospace', fontSize: '12px', padding: '6px 8px', borderRadius: '4px', border: '1px solid #cfc9c3' }}
        />
      </div>
      <div className="preferences-setting-note" style={{ margin: '8px 0' }}>
        Variables available: <code>%s</code> (Scaled mark), <code>%m</code> (Max mark), <code>%S</code> (Total score), <code>%M</code> (Max score), <code>%(ID)</code> (Student ID), <code>%(name)</code> (Student name).
      </div>
    </div>
  );

  const renderEmail = () => (
    <div className="preferences-tab-body">
      <div className="preferences-section-title">Sending emails (SMTP Configuration)</div>
      <div className="preferences-grid email-grid">
        <label htmlFor="email-sender">Sender email</label>
        <input
          id="email-sender"
          type="email"
          defaultValue={preferences.email_sender}
          placeholder="e.g. teacher@gmail.com"
          onBlur={(e) => void savePreferences({ email_sender: e.target.value })}
        />

        <label htmlFor="email-cc">Carbon copy address (Cc)</label>
        <input
          id="email-cc"
          type="email"
          defaultValue={preferences.email_cc}
          placeholder="e.g. assistant@gmail.com"
          onBlur={(e) => void savePreferences({ email_cc: e.target.value })}
        />

        <label htmlFor="email-bcc">Blind Carbon copy address (Bcc)</label>
        <input
          id="email-bcc"
          type="email"
          defaultValue={preferences.email_bcc}
          placeholder="e.g. archive@school.edu.vn"
          onBlur={(e) => void savePreferences({ email_bcc: e.target.value })}
        />

        <label htmlFor="email-delay">Delay between sendings (s)</label>
        <input
          id="email-delay"
          type="number"
          step="0.5"
          min="0"
          defaultValue={preferences.email_delay}
          onBlur={(e) => void savePreferences({ email_delay: Math.max(0, Number(e.target.value) || 0) })}
        />

        <label htmlFor="email-smtp-host">SMTP host</label>
        <input
          id="email-smtp-host"
          type="text"
          defaultValue={preferences.email_smtp_host}
          placeholder="e.g. smtp.gmail.com"
          onBlur={(e) => void savePreferences({ email_smtp_host: e.target.value })}
        />

        <label htmlFor="email-smtp-port">SMTP port</label>
        <input
          id="email-smtp-port"
          type="number"
          min="1"
          max="65535"
          defaultValue={preferences.email_smtp_port}
          onBlur={(e) => void savePreferences({ email_smtp_port: Number(e.target.value) || 465 })}
        />

        <label htmlFor="email-smtp-ssl">SMTP security</label>
        <select
          id="email-smtp-ssl"
          value={preferences.email_smtp_ssl}
          onChange={(e) => void savePreferences({ email_smtp_ssl: e.target.value })}
        >
          <option value="SSL">SSL (Port 465)</option>
          <option value="STARTTLS">STARTTLS (Port 587)</option>
          <option value="None">None (Unencrypted)</option>
        </select>

        <label htmlFor="email-smtp-user">SMTP user</label>
        <input
          id="email-smtp-user"
          type="text"
          defaultValue={preferences.email_smtp_user}
          placeholder="e.g. teacher@gmail.com"
          onBlur={(e) => void savePreferences({ email_smtp_user: e.target.value })}
        />

        <label htmlFor="email-smtp-password">SMTP password / App password</label>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            id="email-smtp-password"
            type={showPassword ? 'text' : 'password'}
            defaultValue={preferences.email_smtp_password}
            placeholder="App password (16 characters for Gmail)"
            onBlur={(e) => void savePreferences({ email_smtp_password: e.target.value })}
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className="preferences-show-pwd-btn"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      <div className="preferences-test-email-box">
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="email"
            value={testRecipient}
            onChange={(e) => setTestRecipient(e.target.value)}
            placeholder="Recipient email for test (defaults to Sender email)"
            style={{ flex: 1, height: '32px', padding: '0 8px', borderRadius: '4px', border: '1px solid #cfc9c3' }}
          />
          <button
            type="button"
            className="preferences-test-btn"
            onClick={handleTestEmail}
            disabled={isTestingEmail}
          >
            {isTestingEmail ? 'Testing...' : 'Test Connection'}
          </button>
        </div>
        {testEmailResult && (
          <div className={`preferences-test-result ${testEmailResult.success ? 'success' : 'error'}`}>
            {testEmailResult.message}
          </div>
        )}
      </div>

      <div className="preferences-section-title preferences-section-spaced">Sending question sheets</div>
      <div className="preferences-email-sub-section">
        <label style={{ display: 'block', fontWeight: 500, marginBottom: '4px', fontSize: '13px' }}>Default subject</label>
        <input
          type="text"
          className="preferences-email-input"
          defaultValue={preferences.df_subjectemail_email_subject}
          onBlur={(e) => void savePreferences({ df_subjectemail_email_subject: e.target.value })}
        />
        <label style={{ display: 'block', fontWeight: 500, margin: '8px 0 4px', fontSize: '13px' }}>Default content</label>
        <textarea
          className="preferences-email-textarea"
          rows={3}
          defaultValue={preferences.df_subjectemail_email_text}
          onBlur={(e) => void savePreferences({ df_subjectemail_email_text: e.target.value })}
        />
        <div className="preferences-setting-note">
          Variables: <code>%n</code> (Exam name), <code>%(name)</code> (Student name), <code>%(forename)</code>, <code>%(id)</code>, etc.
        </div>
      </div>

      <div className="preferences-section-title preferences-section-spaced">Sending annotated answer sheets</div>
      <div className="preferences-email-sub-section">
        <label style={{ display: 'block', fontWeight: 500, marginBottom: '4px', fontSize: '13px' }}>Default subject</label>
        <input
          type="text"
          className="preferences-email-input"
          defaultValue={preferences.df_annotatedemail_email_subject}
          onBlur={(e) => void savePreferences({ df_annotatedemail_email_subject: e.target.value })}
        />
        <label style={{ display: 'block', fontWeight: 500, margin: '8px 0 4px', fontSize: '13px' }}>Default content</label>
        <textarea
          className="preferences-email-textarea"
          rows={3}
          defaultValue={preferences.df_annotatedemail_email_text}
          onBlur={(e) => void savePreferences({ df_annotatedemail_email_text: e.target.value })}
        />
        <div className="preferences-setting-note">
          Variables: <code>%s</code> (Scaled mark), <code>%m</code> (Max mark), <code>%S</code> (Raw score), <code>%M</code> (Max raw), <code>%n</code>, <code>%(name)</code>, etc.
        </div>
      </div>
    </div>
  );

  const renderProject = () => {
    if (!currentProject) {
      return (
        <div className="preferences-tab-body">
          <div className="project-pref-header-notice" style={{ textAlign: 'center', padding: '60px 20px', color: '#777' }}>
            <em>No project is currently open. Please open a project first to configure its preferences.</em>
          </div>
        </div>
      );
    }

    return (
      <div className="preferences-tab-body">
        <div className="project-pref-header-notice" style={{ textAlign: 'center', marginBottom: '14px', color: '#555', fontStyle: 'italic' }}>
          Project &quot;{currentProject}&quot; preferences.
        </div>

        {/* 1. Automatic data capture */}
        <div className="preferences-section-title">Automatic data capture</div>
        <div className="preferences-grid display-grid">
          <label htmlFor="proj-darkness-threshold">Darkness threshold</label>
          <div className="pref-spinner-group">
            <input
              id="proj-darkness-threshold"
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={projectPrefs.seuil}
              onChange={(e) => updateProjectPref('seuil', parseFloat(e.target.value) || 0)}
            />
            <button
              type="button"
              className="pref-spin-btn"
              onClick={() => updateProjectPref('seuil', Math.max(0, parseFloat((projectPrefs.seuil - 0.01).toFixed(2))))}
            >
              −
            </button>
            <button
              type="button"
              className="pref-spin-btn"
              onClick={() => updateProjectPref('seuil', Math.min(1, parseFloat((projectPrefs.seuil + 0.01).toFixed(2))))}
            >
              +
            </button>
          </div>

          <label htmlFor="proj-upper-darkness-threshold">Upper darkness threshold</label>
          <div className="pref-spinner-group">
            <input
              id="proj-upper-darkness-threshold"
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={projectPrefs.seuil_up}
              onChange={(e) => updateProjectPref('seuil_up', parseFloat(e.target.value) || 0)}
            />
            <button
              type="button"
              className="pref-spin-btn"
              onClick={() => updateProjectPref('seuil_up', Math.max(0, parseFloat((projectPrefs.seuil_up - 0.01).toFixed(2))))}
            >
              −
            </button>
            <button
              type="button"
              className="pref-spin-btn"
              onClick={() => updateProjectPref('seuil_up', Math.min(1, parseFloat((projectPrefs.seuil_up + 0.01).toFixed(2))))}
            >
              +
            </button>
          </div>

          <label htmlFor="proj-name-field-type">Name field type</label>
          <select
            id="proj-name-field-type"
            value={projectPrefs.name_field_type}
            onChange={(e) => updateProjectPref('name_field_type', e.target.value)}
          >
            <option value="image">Image</option>
            <option value="none">None</option>
            <option value="barcode">Barcode</option>
          </select>
        </div>

        {/* 2. Global mark rules */}
        <div className="preferences-section-title preferences-section-spaced">Global mark rules</div>
        <div className="preferences-grid display-grid">
          <label htmlFor="proj-minimal-mark">Minimal mark</label>
          <input
            id="proj-minimal-mark"
            type="text"
            value={projectPrefs.note_null}
            onChange={(e) => updateProjectPref('note_null', e.target.value)}
          />

          <label htmlFor="proj-floor-mark">Floor mark</label>
          <input
            id="proj-floor-mark"
            type="text"
            value={projectPrefs.note_min}
            onChange={(e) => updateProjectPref('note_min', e.target.value)}
          />

          <label htmlFor="proj-maximal-mark">Maximal mark</label>
          <div className="pref-mark-max-group">
            <input
              id="proj-maximal-mark"
              type="text"
              value={projectPrefs.note_max}
              onChange={(e) => updateProjectPref('note_max', e.target.value)}
              style={{ flex: 1 }}
            />
            <label className="pref-checkbox-label" style={{ marginLeft: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={projectPrefs.note_max_plafond}
                onChange={(e) => updateProjectPref('note_max_plafond', e.target.checked)}
              />
              <span>ceil</span>
            </label>
          </div>

          <label htmlFor="proj-grain">Grain</label>
          <input
            id="proj-grain"
            type="text"
            value={projectPrefs.note_grain}
            onChange={(e) => updateProjectPref('note_grain', e.target.value)}
          />

          <label htmlFor="proj-rounding-type">Rounding type</label>
          <select
            id="proj-rounding-type"
            value={projectPrefs.note_arrondi}
            onChange={(e) => updateProjectPref('note_arrondi', e.target.value)}
          >
            <option value="rounding">rounding</option>
            <option value="ceiling">ceiling</option>
            <option value="floor">floor</option>
          </select>
        </div>

        {/* 3. Papers annotation */}
        <div className="preferences-section-title preferences-section-spaced">Papers annotation</div>
        <div style={{ textAlign: 'center', margin: '6px 0 4px', fontStyle: 'italic', fontSize: '13px', color: '#555' }}>
          Header text
        </div>
        <div style={{ margin: '0 0 10px' }}>
          <textarea
            className="preferences-email-textarea"
            rows={3}
            value={projectPrefs.verdict}
            onChange={(e) => updateProjectPref('verdict', e.target.value)}
            style={{ width: '100%', fontFamily: 'monospace', fontSize: '12px', padding: '6px 8px', borderRadius: '4px', border: '1px solid #cfc9c3' }}
          />
        </div>

        <div className="preferences-grid display-grid">
          <label htmlFor="proj-writing-direction">Writing direction</label>
          <label className="pref-checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input
              id="proj-writing-direction"
              type="checkbox"
              checked={projectPrefs.annote_rtl}
              onChange={(e) => updateProjectPref('annote_rtl', e.target.checked)}
            />
            <span>right to left</span>
          </label>

          <label htmlFor="proj-questions-marks-position">Questions marks position</label>
          <select
            id="proj-questions-marks-position"
            value={projectPrefs.annote_position}
            onChange={(e) => updateProjectPref('annote_position', e.target.value)}
          >
            <option value="marges">in the margins</option>
            <option value="case">near the boxes</option>
            <option value="none">none</option>
          </select>

          <label htmlFor="proj-verdict-q">Questions annotation text</label>
          <input
            id="proj-verdict-q"
            type="text"
            value={projectPrefs.verdict_q}
            onChange={(e) => updateProjectPref('verdict_q', e.target.value)}
          />

          <label htmlFor="proj-verdict-qc">Cancelled questions annotation text</label>
          <input
            id="proj-verdict-qc"
            type="text"
            value={projectPrefs.verdict_qc}
            onChange={(e) => updateProjectPref('verdict_qc', e.target.value)}
          />
        </div>

        {/* 4. Examination description */}
        <div className="preferences-section-title preferences-section-spaced">Examination description</div>
        <div className="preferences-grid display-grid">
          <label htmlFor="proj-nom-examen">Examination name</label>
          <input
            id="proj-nom-examen"
            type="text"
            value={projectPrefs.nom_examen}
            onChange={(e) => updateProjectPref('nom_examen', e.target.value)}
          />

          <label htmlFor="proj-code-examen">Code (short name) for examination</label>
          <input
            id="proj-code-examen"
            type="text"
            value={projectPrefs.code_examen}
            onChange={(e) => updateProjectPref('code_examen', e.target.value)}
          />
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="preferences-overlay">
      <div className="preferences-window">
        <div className="preferences-header">
          <button type="button" className="btn preferences-undo-btn" onClick={handleUndo} title="Revert changes in this tab">
            Undo
          </button>
          <div className="preferences-title">AMC Preferences</div>
          <button type="button" className="btn btn-primary preferences-ok-btn" onClick={handleOk} title="Save & Close">
            OK
          </button>
        </div>

        <div className="preferences-tabs">
          {tabs.map((tab) => (
            <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>
              {tab}
            </button>
          ))}
        </div>

        {error && <div className="preferences-error">{error}</div>}
        {activeTab === 'Main' && renderMain()}
        {activeTab === 'Features' && renderFeatures()}
        {activeTab === 'Display' && renderDisplay()}
        {activeTab === 'Scan' && renderScan()}
        {activeTab === 'Marking' && renderMarking()}
        {activeTab === 'Annotation' && renderAnnotation()}
        {activeTab === 'Email' && renderEmail()}
        {activeTab === 'Project' && renderProject()}
      </div>
    </div>
  );
};
