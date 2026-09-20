import React, { useState, useEffect } from 'react';
import { OpenProjectModal } from './components/OpenProjectModal';
import { CreateProjectModal } from './components/CreateProjectModal';
import { LatexEditorModal } from './components/LatexEditorModal';
import { ManualAssociationModal } from './components/ManualAssociationModal';
import { CsvEditorModal } from './components/CsvEditorModal';
import { PreferencesModal, type PreferencesData } from './components/PreferencesModal';
import { MailingModal } from './components/MailingModal';
import ManualCaptureModal from './ManualCaptureModal';
import { ManageProjectsModal } from './components/ManageProjectsModal';
import { SaveAsTemplateModal } from './components/SaveAsTemplateModal';
import { CleanupModal } from './components/CleanupModal';
import { UnrecognizedScansModal } from './components/UnrecognizedScansModal';
import { PostcorrectModal, type PostcorrectSheet } from './components/PostcorrectModal';
import { MarksModal } from './components/MarksModal';
import { ChooseColumnsModal } from './components/ChooseColumnsModal';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('Preparation');
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [isOpenProjectOpen, setOpenProjectOpen] = useState(false);
  const [isManageProjectsOpen, setManageProjectsOpen] = useState(false);
  const [isSaveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [isCleanupOpen, setCleanupOpen] = useState(false);
  const [isUnrecognizedModalOpen, setIsUnrecognizedModalOpen] = useState(false);
  const [isPostcorrectModalOpen, setIsPostcorrectModalOpen] = useState(false);
  const [isMarksModalOpen, setIsMarksModalOpen] = useState(false);
  const [isChooseColumnsOpen, setIsChooseColumnsOpen] = useState(false);
  const [exportColumns, setExportColumns] = useState<string[]>([]);
  const [includeAbsentees, setIncludeAbsentees] = useState(false);
  const [postcorrectData, setPostcorrectData] = useState<{
    sheets: PostcorrectSheet[];
    default_student: number;
    default_copy: number;
    default_set_multiple: boolean;
  } | null>(null);
  const [activeTopMenu, setActiveTopMenu] = useState<'main' | 'project' | null>(null);
  const [isEditorOpen, setEditorOpen] = useState(false);
  const [isPreferencesOpen, setPreferencesOpen] = useState(false);
  const [isMailingOpen, setIsMailingOpen] = useState(false);
  const [isPrepMailingOpen, setIsPrepMailingOpen] = useState(false);
  const [appPreferences, setAppPreferences] = useState<Partial<PreferencesData>>({
    notify_preparation: false,
    notify_data_capture: true,
    notify_grading: true,
    notify_annotation: true,
  });
  const [completionNotification, setCompletionNotification] = useState<string | null>(null);
  const [currentProject, setCurrentProject] = useState<string | null>(null);
  const [sourceFormat, setSourceFormat] = useState('latex');
  const [numCopies, setNumCopies] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);
  const [hasCompiled, setHasCompiled] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [hasDetected, setHasDetected] = useState(false);
  const [numPages, setNumPages] = useState<number>(0);
  const [captureData, setCaptureData] = useState<any[]>([]);
  const [captureFailures, setCaptureFailures] = useState<string[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [isZoomsOpen, setIsZoomsOpen] = useState(false);
  const [zoomsData, setZoomsData] = useState<any[]>([]);
  const [zoomsMode, setZoomsMode] = useState<'drag and drop' | 'click'>('drag and drop');
  const [zoomsBoxSize, setZoomsBoxSize] = useState<number>(48);
  const [showZoomsModeMenu, setShowZoomsModeMenu] = useState(false);
  const [draggedBox, setDraggedBox] = useState<any | null>(null);
  const [isOverUnchecked, setIsOverUnchecked] = useState(false);
  const [isOverChecked, setIsOverChecked] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({ updated: true, mse: true, sensitivity: true, scanFile: true });
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  
  const [updateMarkingScale, setUpdateMarkingScale] = useState(true);
  const [isMarking, setIsMarking] = useState(false);
  const [isAnonymizing, setIsAnonymizing] = useState(false);
  const [anonymityStatus, setAnonymityStatus] = useState<{sheets: number, scores: number, students: number} | null>(null);
  const externalScoresInputRef = React.useRef<HTMLInputElement>(null);
  const [markingStatus, setMarkingStatus] = useState<{computed: boolean, count: number, mean: number | null} | null>(null);
  const [studentsListFile, setStudentsListFile] = useState<string | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [primaryKey, setPrimaryKey] = useState<string | null>(null);
  const [automaticCodeOptions, setAutomaticCodeOptions] = useState<{name: string, digits: number}[]>([]);
  const [automaticCodeName, setAutomaticCodeName] = useState('');
  const [isAutomaticAssociating, setIsAutomaticAssociating] = useState(false);
  const [misclassified, setMisclassified] = useState<number | null>(null);
  const [isManualAssociationOpen, setIsManualAssociationOpen] = useState(false);
  const [isCsvEditorOpen, setIsCsvEditorOpen] = useState(false);
  const [missingIdentification, setMissingIdentification] = useState<number | null>(null);
  const [reportSorting, setReportSorting] = useState('name');
  const [reportSeparator, setReportSeparator] = useState(';');
  const [isExportingMarks, setIsExportingMarks] = useState(false);
  const [annotationMode, setAnnotationMode] = useState('per_student');
  const [filenameModel, setFilenameModel] = useState('(N)-(ID)');
  const [includeSubjectPages, setIncludeSubjectPages] = useState(false);
  const [annotationScope, setAnnotationScope] = useState('all_students');
  const [annotationCandidates, setAnnotationCandidates] = useState<{value: string, name: string, forename: string}[]>([]);
  const [selectedAnnotationValues, setSelectedAnnotationValues] = useState<string[]>([]);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Layout Analysis modal states
  const [isLayoutOpen, setIsLayoutOpen] = useState(false);
  const [layoutImageUrl, setLayoutImageUrl] = useState<string | null>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  React.useEffect(() => {
    if (currentProject && activeTab === 'Data capture') {
      fetchCaptureData();
    }
  }, [currentProject, activeTab]);

  React.useEffect(() => {
    if (currentProject && activeTab === 'Data capture') fetchCaptureData();
  }, [appPreferences?.limit_mse, appPreferences?.limit_sensitivity]);

  React.useEffect(() => {
    fetch('http://localhost:8000/api/projects/preferences')
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (data) setAppPreferences(data); })
      .catch(() => undefined);
  }, []);

  const showCompletionNotification = (message: string) => {
    setCompletionNotification(message);
    window.setTimeout(() => setCompletionNotification(null), 4200);
  };

  const notifyCompletion = (setting: 'notify_preparation' | 'notify_data_capture' | 'notify_grading' | 'notify_annotation', message: string) => {
    if (!appPreferences[setting]) return;
    showCompletionNotification(message);
  };

  const fetchCaptureData = () => {
    if (!currentProject) return;
    const codeParameter = automaticCodeName ? `?code_name=${encodeURIComponent(automaticCodeName)}` : '';
    fetch(`http://localhost:8000/api/projects/${currentProject}/capture_data${codeParameter}`)
      .then(res => res.json())
      .then(data => {
        setCaptureData(data.data || []);
        setCaptureFailures(data.failed_scans || []);
      })
      .catch(err => console.error(err));
  };

  const handleCaptureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentProject || !e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));

    setIsCapturing(true);
    fetch(`http://localhost:8000/api/projects/${currentProject}/capture`, {
      method: 'POST',
      body: formData
    })
      .then(async res => {
        if (!res.ok) {
           const err = await res.json();
           alert("Capture failed: " + err.detail);
        } else {
           fetchCaptureData();
           notifyCompletion('notify_data_capture', 'Data capture completed.');
        }
      })
      .catch(err => {
        console.error(err);
        alert('Network error');
      })
      .finally(() => {
        setIsCapturing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      });
  };

  React.useEffect(() => {
    if (isZoomsOpen && selectedRowIndex !== null && captureData[selectedRowIndex]) {
      const row = captureData[selectedRowIndex];
      let student = 0, page = 0, copy = 0;
      const parts = row.identifier.split(':');
      const sp = parts[0].split('/');
      if (sp.length === 2) {
         student = parseInt(sp[0]);
         page = parseInt(sp[1]);
      }
      if (parts.length === 2) {
         copy = parseInt(parts[1]);
      }
      
      fetch(`http://localhost:8000/api/projects/${currentProject}/capture_zooms?student=${student}&page=${page}&copy=${copy}`)
        .then(res => res.json())
        .then(data => setZoomsData(data.boxes || []))
        .catch(err => console.error(err));
    }
  }, [isZoomsOpen, selectedRowIndex, captureData, currentProject]);

  const handleToggleZoomBox = async (box: any) => {
    if (selectedRowIndex === null || !captureData[selectedRowIndex] || !currentProject) return;
    const row = captureData[selectedRowIndex];
    let student = 0, page = 0, copy = 0;
    const parts = row.identifier.split(':');
    const sp = parts[0].split('/');
    if (sp.length === 2) {
       student = parseInt(sp[0]);
       page = parseInt(sp[1]);
    }
    if (parts.length === 2) {
       copy = parseInt(parts[1]);
    }
    const newChecked = !box.checked;

    // Optimistic UI update
    setZoomsData(prev => prev.map(b => (b.id_a === box.id_a && b.id_b === box.id_b ? { ...b, checked: newChecked } : b)));

    try {
      const res = await fetch(`http://localhost:8000/api/projects/${encodeURIComponent(currentProject)}/capture_zone_toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student,
          page,
          copy,
          question: box.id_a,
          answer: box.id_b,
          checked: newChecked
        })
      });
      if (!res.ok) {
        throw new Error("Failed to update box state");
      }
    } catch (err) {
      console.error("Error toggling zoom box:", err);
      // Revert optimistic update on failure
      setZoomsData(prev => prev.map(b => (b.id_a === box.id_a && b.id_b === box.id_b ? { ...b, checked: !newChecked } : b)));
    }
  };

  const handleDragStart = (e: React.DragEvent, box: any) => {
    if (zoomsMode !== 'drag and drop') return;
    setDraggedBox(box);
    e.dataTransfer.setData('text/plain', JSON.stringify({ id_a: box.id_a, id_b: box.id_b, checked: box.checked }));
  };

  const handleDropOnZone = (targetChecked: boolean) => {
    if (zoomsMode !== 'drag and drop' || !draggedBox) return;
    if (draggedBox.checked !== targetChecked) {
      handleToggleZoomBox(draggedBox);
    }
    setDraggedBox(null);
  };

  const handleOpenLayout = () => {
    if (selectedRowIndex === null || !captureData[selectedRowIndex]) return;
    const row = captureData[selectedRowIndex];
    let student = 0, page = 0, copy = 0;
    const parts = row.identifier.split(':');
    const sp = parts[0].split('/');
    if (sp.length === 2) {
       student = parseInt(sp[0]);
       page = parseInt(sp[1]);
    }
    if (parts.length === 2) {
       copy = parseInt(parts[1]);
    }
    const timestamp = new Date().getTime();
    setLayoutImageUrl(`http://localhost:8000/api/projects/${currentProject}/capture_layout?student=${student}&page=${page}&copy=${copy}&t=${timestamp}`);
    setIsLayoutOpen(true);
  };

  const handleRemoveCapture = () => {
    if (selectedRowIndex === null || !captureData[selectedRowIndex]) return;
    const row = captureData[selectedRowIndex];
    if (!window.confirm(`Are you sure you want to remove the data for page ${row.identifier}?`)) return;

    let student = 0, page = 0, copy = 0;
    const parts = row.identifier.split(':');
    const sp = parts[0].split('/');
    if (sp.length === 2) {
       student = parseInt(sp[0]);
       page = parseInt(sp[1]);
    }
    if (parts.length === 2) {
       copy = parseInt(parts[1]);
    }

    fetch(`http://localhost:8000/api/projects/${currentProject}/capture?student=${student}&page=${page}&copy=${copy}`, {
      method: 'DELETE'
    })
      .then(async res => {
        if (!res.ok) {
           const err = await res.json();
           alert("Remove failed: " + err.detail);
        } else {
           setSelectedRowIndex(null);
           fetchCaptureData();
        }
      })
      .catch(err => {
        console.error(err);
        alert('Network error');
      });
  };

  React.useEffect(() => {
    if (currentProject) {
      fetch(`http://localhost:8000/api/projects/${encodeURIComponent(currentProject)}/copies`)
        .then(res => res.json())
        .then(data => setNumCopies(data.copies || 0))
        .catch(err => console.error(err));

      // Auto-detect project status (compiled state, layout detection, and default CSV)
      fetch(`http://localhost:8000/api/projects/${encodeURIComponent(currentProject)}/status`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (!data) return;
          setHasCompiled(!!data.has_compiled);
          setHasDetected(!!data.has_detected);
          if (data.pages) setNumPages(data.pages);
          if (data.default_csv) {
            setStudentsListFile((current) => current || data.default_csv);
            fetch(`http://localhost:8000/api/projects/${encodeURIComponent(currentProject)}/csv_headers?file=${encodeURIComponent(data.default_csv)}`)
              .then(res => res.ok ? res.json() : null)
              .then(hdata => {
                if (hdata && hdata.headers) {
                  setCsvHeaders(hdata.headers);
                  setPrimaryKey(prev => prev && hdata.headers.includes(prev) ? prev : (hdata.headers[0] || null));
                }
              })
              .catch(err => console.error(err));
          }
        })
        .catch(err => console.error(err));
    } else {
      setHasCompiled(false);
      setHasDetected(false);
      setNumPages(0);
      setStudentsListFile(null);
    }
  }, [currentProject]);

  const handleUpdateCopies = (delta: number) => {
    if (!currentProject) return;
    const newVal = Math.max(0, numCopies + delta);
    setNumCopies(newVal);
    fetch(`http://localhost:8000/api/projects/${currentProject}/copies`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ copies: newVal })
    }).catch(err => console.error(err));
  };

  const handleUpdateDocuments = () => {
    if (!currentProject) return;
    setIsUpdating(true);
    fetch(`http://localhost:8000/api/projects/${currentProject}/prepare`, {
      method: 'POST'
    })
      .then(async res => {
        if (res.ok) {
          setHasCompiled(true);
          notifyCompletion('notify_preparation', 'Documents update completed.');
        } else {
          const errData = await res.json();
          alert('Error updating documents: ' + (errData.detail || 'Unknown error'));
        }
      })
      .catch(err => {
        console.error(err);
        alert('Failed to connect to backend.');
      })
      .finally(() => setIsUpdating(false));
  };

  const handleLayoutDetection = () => {
    if (!currentProject) return;
    setIsDetecting(true);
    fetch(`http://localhost:8000/api/projects/${currentProject}/layout_detection`, {
      method: 'POST'
    })
      .then(async res => {
        if (res.ok) {
          const data = await res.json();
          setHasDetected(true);
          setNumPages(data.pages || 0);
        } else {
          const errData = await res.json();
          alert('Error layout detection: ' + (errData.detail || 'Unknown error'));
        }
      })
      .catch(err => {
        console.error(err);
        alert('Failed to connect to backend.');
      })
      .finally(() => setIsDetecting(false));
  };

  const handleDownload = async (type: string) => {
    if (!currentProject) return;
    try {
      const timestamp = new Date().getTime();
      const res = await fetch(`http://localhost:8000/api/projects/${currentProject}/pdf/${type}?t=${timestamp}`);
      if (!res.ok) {
        const err = await res.json();
        alert('Download failed: ' + err.detail);
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DOC-${type}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Network error downloading PDF');
    }
  };

  const handleMarksExport = async () => {
    if (!currentProject || !studentsListFile || !primaryKey) {
      alert('Choose a students list and primary key in Marking before exporting marks.');
      return;
    }
    setIsExportingMarks(true);
    try {
      const payload: any = {
        csv_file: studentsListFile,
        primary_key: primaryKey,
        sorting: reportSorting,
        separator: reportSeparator,
        include_absentees: includeAbsentees,
      };
      if (exportColumns && exportColumns.length > 0) {
        payload.export_columns = exportColumns;
      }
      const response = await fetch(`http://localhost:8000/api/projects/${encodeURIComponent(currentProject)}/reports/marks_export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error((await response.json()).detail || 'Unable to export marks.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'marks.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showCompletionNotification('Marks CSV downloaded successfully.');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to export marks.');
    } finally {
      setIsExportingMarks(false);
    }
  };

  const loadAnnotationCandidates = async () => {
    if (!currentProject || !studentsListFile || !primaryKey) return;
    try {
      const response = await fetch(`http://localhost:8000/api/projects/${encodeURIComponent(currentProject)}/reports/annotate_candidates?file=${encodeURIComponent(studentsListFile)}&primary_key=${encodeURIComponent(primaryKey)}`);
      if (!response.ok) throw new Error((await response.json()).detail || 'Unable to load students.');
      const data = await response.json();
      setAnnotationCandidates(data.students || []);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to load students.');
    }
  };

  const handleAnnotationScope = (scope: string) => {
    setAnnotationScope(scope);
    if (scope === 'selected_students') loadAnnotationCandidates();
  };

  const fetchAnnotateOptions = async () => {
    if (!currentProject) return;
    try {
      const res = await fetch(`http://localhost:8000/api/projects/${encodeURIComponent(currentProject)}/reports/annotate_options`);
      if (res.ok) {
        const data = await res.json();
        if (data.filename_model !== undefined) {
          setFilenameModel(data.filename_model || '(N)-(ID)');
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeTab === 'Reports' && currentProject) {
      fetchAnnotateOptions();
    }
  }, [activeTab, currentProject]);

  const handleAnnotatePapers = async () => {
    if (!currentProject || !studentsListFile || !primaryKey) {
      alert('Choose a students list and primary key in Marking first.');
      return;
    }
    if (annotationScope === 'selected_students' && selectedAnnotationValues.length === 0) {
      alert('Select at least one student.');
      return;
    }
    setIsAnnotating(true);
    try {
      const response = await fetch(`http://localhost:8000/api/projects/${encodeURIComponent(currentProject)}/reports/annotate_papers`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csv_file: studentsListFile,
          primary_key: primaryKey,
          output_mode: annotationMode,
          include_subject: includeSubjectPages,
          selected_values: annotationScope === 'selected_students' ? selectedAnnotationValues : [],
          filename_model: filenameModel,
        }),
      });
      if (!response.ok) throw new Error((await response.json()).detail || 'Unable to annotate papers.');
      const data = await response.json();
      alert(`Created ${data.files.length} annotated PDF file${data.files.length === 1 ? '' : 's'} in cr/corrections/pdf.`);
      notifyCompletion('notify_annotation', 'Annotation completed.');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to annotate papers.');
    } finally {
      setIsAnnotating(false);
    }
  };

  // -----------------------------------------------------
  // Marking Handlers
  // -----------------------------------------------------
  const fetchMarkingStatus = async () => {
    if (!currentProject) return;
    try {
      await fetchAutomaticCodeOptions();
      const res = await fetch(`http://localhost:8000/api/projects/${currentProject}/marking_status`);
      if (res.ok) {
        const data = await res.json();
        setMarkingStatus(data);
      }

      const csvRes = await fetch(`http://localhost:8000/api/projects/${currentProject}/csv_files`);
      if (csvRes.ok) {
        const csvData = await csvRes.json();
        if (csvData.files.includes('list.csv') && !studentsListFile) {
          setStudentsListFile('list.csv');
          const headerRes = await fetch(`http://localhost:8000/api/projects/${currentProject}/csv_headers?file=list.csv`);
          if (headerRes.ok) {
            const headerData = await headerRes.json();
            setCsvHeaders(headerData.headers);
            setPrimaryKey(headerData.headers[0] || null);
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeTab === 'Marking' && currentProject) {
      fetchMarkingStatus();
      fetchAnonymityStatus();
    }
  }, [activeTab, currentProject]);

  
  const fetchAnonymityStatus = async () => {
    if (!currentProject) return;
    try {
      const response = await fetch(`http://localhost:8000/api/projects/${encodeURIComponent(currentProject)}/anonymity_status`);
      if (response.ok) {
        setAnonymityStatus(await response.json());
      }
    } catch (error) {
      console.error(error);
    }
  };

  const fetchIdentificationStatus = async () => {
    if (!currentProject || !primaryKey) {
      setMissingIdentification(null);
      return;
    }
    try {
      const response = await fetch(`http://localhost:8000/api/projects/${currentProject}/identification_status?primary_key=${encodeURIComponent(primaryKey)}`);
      if (!response.ok) throw new Error('Unable to retrieve identification status');
      const data = await response.json();
      setMissingIdentification(data.missing);
      setMisclassified(data.automatic_run ? data.missing : null);
    } catch (error) {
      console.error(error);
      setMissingIdentification(null);
      setMisclassified(null);
    }
  };

  useEffect(() => {
    if (activeTab === 'Marking') fetchIdentificationStatus();
  }, [activeTab, currentProject, primaryKey]);

  const fetchAutomaticCodeOptions = async () => {
    if (!currentProject) return;
    try {
      const response = await fetch(`http://localhost:8000/api/projects/${encodeURIComponent(currentProject)}/automatic_association_codes`);
      if (!response.ok) throw new Error('Unable to load AMC code declarations.');
      const data = await response.json();
      const codes = data.codes || [];
      setAutomaticCodeOptions(codes);
      setAutomaticCodeName((current) => current && codes.some((code: {name: string}) => code.name === current) ? current : codes[0]?.name || '');
    } catch (error) {
      console.error(error);
      setAutomaticCodeOptions([]);
      setAutomaticCodeName('');
    }
  };

  const handleAutomaticAssociation = async () => {
    if (!currentProject || !studentsListFile || !primaryKey || !automaticCodeName) {
      alert('Choose a students list, primary key, and AMC code name first.');
      return;
    }
    setIsAutomaticAssociating(true);
    try {
      const response = await fetch(`http://localhost:8000/api/projects/${encodeURIComponent(currentProject)}/automatic_association`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv_file: studentsListFile, primary_key: primaryKey, code_name: automaticCodeName }),
      });
      if (!response.ok) throw new Error((await response.json()).detail || 'Automatic association failed.');
      const data = await response.json();
      setMissingIdentification(data.misclassified);
      setMisclassified(data.misclassified);
      fetchCaptureData();
      if (data.misclassified === 0) alert(`Automatic association completed: ${data.matched}/${data.total} answer sheets matched.`);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Automatic association failed.');
    } finally {
      setIsAutomaticAssociating(false);
    }
  };

  
  const handleAnonymize = async () => {
    if (!currentProject) return;
    setIsAnonymizing(true);
    try {
      const response = await fetch(`http://localhost:8000/api/projects/${encodeURIComponent(currentProject)}/anonymize`, {
        method: 'POST',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to anonymize');
      }
      alert('Anonymization complete. PDFs generated in the anonymous directory.');
    } catch (error: any) {
      alert(error.message || 'An error occurred during anonymization.');
    } finally {
      setIsAnonymizing(false);
    }
  };

  
  const handleClearExternalScores = async () => {
    if (!currentProject) return;
    if (!window.confirm("Are you sure you want to clear all external scores?")) return;
    try {
      const response = await fetch(`http://localhost:8000/api/projects/${encodeURIComponent(currentProject)}/external_scores`, { method: 'DELETE' });
      if (response.ok) {
        fetchAnonymityStatus();
      } else {
        alert("Failed to clear scores.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUploadExternalScores = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentProject) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch(`http://localhost:8000/api/projects/${encodeURIComponent(currentProject)}/external_scores`, {
        method: 'POST',
        body: formData
      });
      if (response.ok) {
        fetchAnonymityStatus();
        alert("External scores uploaded successfully.");
      } else {
        const err = await response.json().catch(()=>({}));
        alert(err.detail || "Failed to upload scores.");
      }
    } catch (e) {
      console.error(e);
    }
    if (externalScoresInputRef.current) externalScoresInputRef.current.value = '';
  };

  const handleOpenAnonymized = () => {
    if (!currentProject) return;
    window.open(`http://localhost:8000/api/projects/${encodeURIComponent(currentProject)}/anonymous_documents`);
  };


  const executeMark = async (postcorrectParams?: { student: number; copy: number; setMultiple: boolean }) => {
    if (!currentProject) return;
    setIsMarking(true);
    try {
      const payload: any = { update_scale: updateMarkingScale };
      if (postcorrectParams) {
        payload.postcorrect_student = postcorrectParams.student;
        payload.postcorrect_copy = postcorrectParams.copy;
        payload.postcorrect_set_multiple = postcorrectParams.setMultiple;
      }
      const res = await fetch(`http://localhost:8000/api/projects/${encodeURIComponent(currentProject)}/mark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        await fetchMarkingStatus();
        fetchAnonymityStatus();
        notifyCompletion('notify_grading', 'Grading completed.');
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || "Marking failed.");
      }
    } catch (err) {
      console.error(err);
      alert("Error occurred during marking.");
    } finally {
      setIsMarking(false);
    }
  };

  const handleMark = async () => {
    if (!currentProject) return;
    setIsMarking(true);
    try {
      const pcRes = await fetch(`http://localhost:8000/api/projects/${encodeURIComponent(currentProject)}/postcorrect_status`);
      if (pcRes.ok) {
        const pcData = await pcRes.json();
        if (pcData.is_postcorrect) {
          setPostcorrectData({
            sheets: pcData.sheets || [],
            default_student: pcData.default_student ?? 1,
            default_copy: pcData.default_copy ?? 0,
            default_set_multiple: pcData.default_set_multiple ?? true,
          });
          setIsPostcorrectModalOpen(true);
          setIsMarking(false);
          return;
        }
      }
      await executeMark();
    } catch (err) {
      console.error(err);
      alert("Error occurred during marking.");
      setIsMarking(false);
    }
  };

  const handleApplyPostcorrect = async (student: number, copy: number, setMultiple: boolean) => {
    setIsPostcorrectModalOpen(false);
    await executeMark({ student, copy, setMultiple });
  };

  const openNativeFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentProject) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`http://localhost:8000/api/projects/${currentProject}/upload_csv`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        setStudentsListFile(file.name);
        const headerRes = await fetch(`http://localhost:8000/api/projects/${currentProject}/csv_headers?file=${file.name}`);
        if (headerRes.ok) {
          const headerData = await headerRes.json();
          setCsvHeaders(headerData.headers);
          setPrimaryKey(headerData.headers[0] || null);
        }
      } else {
        alert("Upload failed.");
      }
    } catch (err) {
      console.error(err);
      alert("Error occurred during file upload.");
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleEditCsv = () => {
    if (studentsListFile) setIsCsvEditorOpen(true);
  };

  return (
    <div className="app-container">
      {/* Top Bar matching desktop */}
      <div className="top-bar">
        <div>Auto Multiple Choice {currentProject ? `- ${currentProject}` : ''}</div>
        <div className="top-bar-actions">
          <button className="btn btn-icon" onClick={() => setPreferencesOpen(true)} title="Preferences"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></button>
          <button className="btn btn-icon" onClick={() => setActiveTopMenu(activeTopMenu === 'main' ? null : 'main')}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>
          
          {/* Main Dropdown Menu */}
          {activeTopMenu === 'main' && (
            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: '#f5f4f2', border: '1px solid #ccc', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', minWidth: 160, zIndex: 1000, overflow: 'hidden' }}>
              <div 
                style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onClick={() => setActiveTopMenu('project')}
                onMouseEnter={e => e.currentTarget.style.background = '#e5e2df'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                Project
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
              </div>
              <div style={{ padding: '8px 12px', cursor: 'pointer', color: '#666', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Plugins
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
              </div>
              <div style={{ padding: '8px 12px', cursor: 'pointer', color: '#666', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Help
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
              </div>
            </div>
          )}

          {/* Project Submenu */}
          {activeTopMenu === 'project' && (
            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: '#f5f4f2', border: '1px solid #ccc', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', minWidth: 200, zIndex: 1000, overflow: 'hidden' }}>
              <div 
                style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px dashed #ccc', display: 'flex', alignItems: 'center', gap: 8 }}
                onClick={() => setActiveTopMenu('main')}
                onMouseEnter={e => e.currentTarget.style.background = '#e5e2df'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
                Project
              </div>
              <div style={{ padding: '8px 12px', cursor: 'not-allowed', color: '#999' }}>Decode name fields</div>
              <div 
                style={{ padding: '8px 12px', cursor: currentProject ? 'pointer' : 'not-allowed', color: currentProject ? '#333' : '#999' }}
                onClick={() => {
                  if (currentProject) {
                    setActiveTopMenu(null);
                    setCleanupOpen(true);
                  }
                }}
                onMouseEnter={e => { if(currentProject) e.currentTarget.style.background = '#e5e2df'; }}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                Cleanup
              </div>
              <div 
                style={{ padding: '8px 12px', cursor: currentProject ? 'pointer' : 'not-allowed', color: currentProject ? '#333' : '#999' }}
                onClick={() => {
                  if (currentProject) {
                    setActiveTopMenu(null);
                    setSaveTemplateOpen(true);
                  }
                }}
                onMouseEnter={e => { if(currentProject) e.currentTarget.style.background = '#e5e2df'; }}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                Export as template
              </div>
              <div 
                style={{ padding: '8px 12px', cursor: 'pointer', borderTop: '1px solid #ddd' }}
                onClick={() => {
                  setActiveTopMenu(null);
                  setManageProjectsOpen(true);
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#e5e2df'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                Manage
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Toolbar with Folder Icons */}
      <div className="main-toolbar">
        <div className="toolbar-group">
          <button className="btn btn-icon" onClick={() => setOpenProjectOpen(true)} title="Open Project">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          </button>
          <button className="btn btn-icon" onClick={() => setCreateOpen(true)} title="Create New Project">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        {['Preparation', 'Data capture', 'Marking', 'Reports'].map(tab => (
          <div 
            key={tab} 
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </div>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="main-content">
        {activeTab === 'Marking' && (
        <div className="marking-panel">
          
          
          {appPreferences?.show_anonymization && (
            <div className="anonymity-panel" style={{ marginBottom: 16 }}>
              <div className="marking-title" style={{ marginTop: 0 }}>Anonymity</div>
              
              <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <label style={{ width: '120px', fontSize: '13px' }}>Anonimization:</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="marking-button" onClick={handleAnonymize} disabled={isAnonymizing}>
                      {isAnonymizing ? 'Anonymizing...' : 'Anonymize'}
                    </button>
                    <button className="marking-button" onClick={handleOpenAnonymized}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: 4}}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                      Open
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <label style={{ width: '120px', fontSize: '13px' }}>External scores:</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="marking-button" onClick={handleClearExternalScores}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: 4}}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="9" x2="15" y2="15"></line><line x1="15" y1="9" x2="9" y2="15"></line></svg>
                      Clear
                    </button>
                    <button className="marking-button" onClick={() => externalScoresInputRef.current?.click()}>
                      Read from file
                    </button>
                    <input type="file" accept=".csv" style={{display: 'none'}} ref={externalScoresInputRef} onChange={handleUploadExternalScores} />
                  </div>
                </div>
              </div>

              {anonymityStatus && (
                <div style={{ backgroundColor: '#c3e6cb', color: '#155724', padding: '6px 16px', fontSize: '12px', borderTop: '1px solid #b1dfbb', borderBottom: '1px solid #b1dfbb' }}>
                  {anonymityStatus.sheets} anonymized sheets / {anonymityStatus.scores} scores from {anonymityStatus.students} students
                </div>
              )}
            </div>
          )}

            <div className="marking-title">Marking</div>
          
          <div className="marking-toolbar">
            <label className="marking-checkbox">
              <input 
                type="checkbox" 
                checked={updateMarkingScale}
                onChange={(e) => setUpdateMarkingScale(e.target.checked)}
                disabled={isMarking}
              />
              <span>Update marking scale</span>
            </label>
            <button 
              onClick={handleMark}
              disabled={isMarking}
              className="marking-button marking-button-mark"
            >
              <span className="text-red-500 mr-1 font-bold">▦</span> Mark
            </button>
          </div>

          {markingStatus?.computed && (
          <div className="marking-success">
                <span>Mean: {markingStatus.mean?.toFixed(2)}</span>
            <button 
              className="marking-info-button" 
              aria-label="Marking information"
              title="View marks table"
              onClick={() => setIsMarksModalOpen(true)}
            >
              i
            </button>
          </div>
          )}

          <fieldset className="identification-section">
            <legend>Students identification</legend>
            
            <div className="student-list-row">
              <span className="w-1/3 text-left">Students list:</span>
              <span className="w-1/3 text-center font-bold">{studentsListFile || '(none)'}</span>
              <div className="student-list-actions">
                <input 
                  type="file" 
                  accept=".csv" 
                  ref={fileInputRef} 
                  className="visually-hidden" 
                  onChange={handleFileUpload} 
                />
                <button onClick={openNativeFilePicker} className="marking-button">
                  <span className="mr-1">📁</span> Set file
                </button>
                <button onClick={handleEditCsv} disabled={!studentsListFile} className="marking-button">
                  <span className="mr-1">📝</span> Edit list
                </button>
              </div>
            </div>

            <div className="identification-field">
              <span>Primary key from this list:</span>
              <select value={primaryKey || ''} onChange={(event) => setPrimaryKey(event.target.value)} disabled={!studentsListFile}>
                {studentsListFile && csvHeaders.length > 0 ? (
                  csvHeaders.map(h => <option key={h}>{h}</option>)
                ) : (
                  <option>(none)</option>
                )}
              </select>
            </div>

            <div className="identification-field">
              <span>Code name for automatic association:</span>
              <select value={automaticCodeName} onChange={(event) => setAutomaticCodeName(event.target.value)} disabled={!studentsListFile || automaticCodeOptions.length === 0}>
                {automaticCodeOptions.length > 0 ? automaticCodeOptions.map((code) => (
                  <option key={code.name} value={code.name}>{code.name} ({code.digits} digits)</option>
                )) : (
                  <option value="">(none)</option>
                )}
              </select>
            </div>

            <div className="association-row">
              <span>Papers/students association:</span>
              <div>
                <button className="marking-button" onClick={handleAutomaticAssociation} disabled={!studentsListFile || !primaryKey || !automaticCodeName || isAutomaticAssociating}>
                  <span className="mr-1 text-[10px] font-mono border border-gray-500 px-0.5 bg-white tracking-tighter">0123</span> {isAutomaticAssociating ? 'Associating...' : 'Automatic'}
                </button>
              </div>
              <div className="association-manual">
                <button className="marking-button" onClick={() => setIsManualAssociationOpen(true)} disabled={!studentsListFile || !primaryKey}>
                  <span className="mr-1 text-red-500">✍</span> Manual
                </button>
              </div>
            </div>
          </fieldset>

          {misclassified !== null && misclassified > 0 ? (
            <div className="identification-warning">
              Misclassified: {misclassified} answer sheet{misclassified === 1 ? '' : 's'} need manual association.
            </div>
          ) : missingIdentification !== null && missingIdentification > 0 && (
            <div className="identification-warning">
              Missing identification for {missingIdentification} answer sheet{missingIdentification === 1 ? '' : 's'}
            </div>
          )}

        </div>
        )}
        {activeTab === 'Preparation' && (
          <div className="prep-container">
            {/* Top row */}
            <div className="prep-section" style={{ borderBottom: 'none', background: 'var(--bg-toolbar)', padding: '8px', margin: '-24px -24px 24px -24px', borderTop: '1px solid var(--border-color)'}}>
              <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                <button className="btn btn-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></button>
                <select className="input-field" style={{width: 'auto', padding: '4px'}} value={sourceFormat} onChange={e => setSourceFormat(e.target.value)}>
                  <option value="latex">LaTeX</option>
                  <option value="txt">AMC-TXT</option>
                </select>
                <button 
                  className="btn" 
                  onClick={() => { if (currentProject) setEditorOpen(true); }}
                  disabled={!currentProject}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit source file
                </button>
              </div>
            </div>

            <div style={{display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16}}>
              <div className="number-stepper">
                <span style={{color: 'var(--text-muted)'}}>Number of papers:</span>
                <input type="text" className="input-field" value={numCopies} readOnly />
                <button className="btn btn-icon" disabled={!currentProject} onClick={() => handleUpdateCopies(-1)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                <button className="btn btn-icon" disabled={!currentProject} onClick={() => handleUpdateCopies(1)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
              </div>
            </div>

            <div style={{display: 'flex', gap: 16, marginBottom: 32}}>
              <button className="btn" onClick={handleUpdateDocuments} disabled={!currentProject || isUpdating}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg> {isUpdating ? 'Updating...' : 'Update documents'}
              </button>
            </div>

            <div style={{display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 32}}>
              <button className="btn" disabled={!hasCompiled} onClick={() => handleDownload('sujet')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Question
              </button>
              {appPreferences.build_catalog !== false && (
                <button className="btn" disabled={!hasCompiled} onClick={() => handleDownload('corrige')}>
                  Catalog
                </button>
              )}
              {appPreferences.build_individual_solution !== false && (
                <button className="btn" disabled={!hasCompiled} onClick={() => handleDownload('indiv_solution')}>
                  Individual Solutions
                </button>
              )}
            </div>

            <button className="btn" style={{marginBottom: hasDetected ? 16 : 32}} onClick={handleLayoutDetection} disabled={!hasCompiled || isDetecting}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg> {isDetecting ? 'Detecting...' : 'Layout detection'}
            </button>

            {hasDetected ? (
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#d4edda', color: '#155724', padding: '12px', marginBottom: 32, position: 'relative', borderRadius: 4, border: '1px solid #c3e6cb'}}>
                Processed {numPages} pages.
                <button 
                  className="btn btn-icon" 
                  onClick={() => handleDownload('layout')} 
                  title="View Layout PDF"
                  style={{position: 'absolute', right: 12, background: 'white', border: '1px solid #ccc'}}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                </button>
              </div>
            ) : (
              <div style={{display: 'flex', justifyContent: 'flex-end', marginBottom: 32}}>
                <button className="btn btn-icon" disabled={true} title="View Layout PDF">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                </button>
              </div>
            )}

            <div style={{display: 'flex', gap: 12, alignItems: 'center'}}>
              <button className="btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> Print papers
              </button>
              <button 
                className="btn"
                disabled={!currentProject}
                onClick={() => setIsPrepMailingOpen(true)}
                title={!currentProject ? "Vui lòng mở một dự án trước" : "Gửi đề thi cho từng học sinh qua email"}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> ↗ Send question sheets…
              </button>
            </div>

          </div>
        )}

        {activeTab === 'Data capture' && (
          <div className="capture-container">
            <div className="capture-header" style={{borderBottom: '1px solid var(--border-color)', marginBottom: 16}}>
              <div style={{fontWeight: 'bold', fontSize: 13, marginBottom: 8}}>Data capture after examination</div>
              <div style={{display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 16}}>
                <input 
                  type="file" 
                  multiple 
                  accept=".pdf,image/*" 
                  ref={fileInputRef} 
                  style={{display: 'none'}} 
                  onChange={handleCaptureUpload}
                />
                <button 
                  className="btn" 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!currentProject || isCapturing}
                  style={{minWidth: 120, justifyContent: 'center'}}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                  {isCapturing ? 'Processing...' : 'Automatic'}
                </button>
                <button 
                  className="btn" 
                  disabled={!currentProject} 
                  style={{minWidth: 120, justifyContent: 'center'}}
                  onClick={() => setIsManualModalOpen(true)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg> Manual
                </button>
              </div>
            </div>

            {captureData.length === 0 ? (
              <div style={{background: '#f8d7da', color: '#721c24', padding: '8px 12px', border: '1px solid #f5c6cb', fontSize: 13}}>
                No data
              </div>
            ) : (
              <div style={{background: '#d4edda', color: '#155724', padding: '8px 12px', border: '1px solid #c3e6cb', fontSize: 13, marginBottom: 16}}>
                Data capture from {captureData.length} complete papers
              </div>
            )}
            {captureFailures.length > 0 && (
              <div style={{
                background: '#dbeafe', 
                color: '#1e3a8a', 
                padding: '8px 12px', 
                border: '1px solid #bfdbfe', 
                borderRadius: 4, 
                fontSize: 13, 
                marginBottom: 12, 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center'
              }}>
                <span>
                  {captureFailures.length} {captureFailures.length === 1 ? 'scan was' : 'scans were'} not recognized.
                </span>
                <button 
                  className="btn" 
                  style={{ 
                    background: 'white', 
                    border: '1px solid #93c5fd', 
                    padding: '3px 8px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 4, 
                    cursor: 'pointer' 
                  }}
                  onClick={() => setIsUnrecognizedModalOpen(true)}
                  title="View unrecognized scans"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                </button>
              </div>
            )}

            <div style={{fontWeight: 'bold', fontSize: 13, marginBottom: 8}}>Diagnosis</div>
            <div style={{display: 'flex', gap: 16, height: 400}}>
              {/* Table side */}
              <div style={{width: 300, border: '1px solid var(--border-color)', background: 'white', overflowY: 'auto'}}>
                <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 13}}>
                  <thead>
                    <tr style={{borderBottom: '1px solid #ccc', background: '#f5f5f5', textAlign: 'left'}}>
                      <th style={{padding: '4px 8px', fontWeight: 'normal', color: 'var(--text-muted)'}}>identifier <span>▼</span></th>
                      {visibleColumns.updated && <th style={{padding: '4px 8px', fontWeight: 'normal', color: 'var(--text-muted)'}}>updated</th>}
                      {visibleColumns.mse && <th style={{padding: '4px 8px', fontWeight: 'normal', color: 'var(--text-muted)'}}>MSE</th>}
                      {visibleColumns.sensitivity && <th style={{padding: '4px 8px', fontWeight: 'normal', color: 'var(--text-muted)'}}>sensitivity</th>}
                      {visibleColumns.scanFile && <th style={{padding: '4px 8px', fontWeight: 'normal', color: 'var(--text-muted)'}}>scan file</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {captureData.map((row, idx) => (
                      <tr 
                        key={idx} 
                        style={{
                          borderBottom: '1px solid #eee', 
                          cursor: 'pointer', 
                          background: selectedRowIndex === idx ? '#0078d4' : 'transparent', 
                          color: selectedRowIndex === idx ? 'white' : 'inherit'
                        }}
                        onClick={() => setSelectedRowIndex(idx)}
                      >
                        <td style={{padding: '4px 8px', background: selectedRowIndex === idx ? '#0078d4' : row.code_invalid ? '#f8d7da' : '#d4edda', color: selectedRowIndex === idx ? 'white' : row.code_invalid ? '#8a1c1c' : undefined}} title={row.code_invalid ? `Invalid ${row.code_name || 'AMC'} code: ${row.code_value || 'blank or double-marked'}` : undefined}>{row.identifier}</td>
                        {visibleColumns.updated && <td style={{padding: '4px 8px'}}>{row.updated}</td>}
                        {visibleColumns.mse && <td style={{padding: '4px 8px', background: selectedRowIndex === idx ? '#0078d4' : row.mse_warning ? '#f8d7da' : undefined, color: selectedRowIndex === idx ? 'white' : row.mse_warning ? '#8a1c1c' : undefined}}>{row.mse}</td>}
                        {visibleColumns.sensitivity && <td style={{padding: '4px 8px', background: selectedRowIndex === idx ? '#0078d4' : row.sensitivity_warning ? '#f8d7da' : undefined, color: selectedRowIndex === idx ? 'white' : row.sensitivity_warning ? '#8a1c1c' : undefined}}>{row.sensitivity}</td>}
                        {visibleColumns.scanFile && <td style={{padding: '4px 8px'}}>{row.scan_file}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Toolbar side */}
              <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
                <div style={{position: 'relative'}}>
                  <button className="btn" style={{width: '100%', background: '#e1dfdd', border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}} onClick={() => setShowColumnsMenu(!showColumnsMenu)}>
                    <span>Columns</span>
                    <span style={{fontSize: 10}}>▼</span>
                  </button>
                  {showColumnsMenu && (
                    <div style={{position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'white', border: '1px solid #ccc', borderRadius: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', zIndex: 100, display: 'flex', flexDirection: 'column', minWidth: 140, padding: '4px 0', fontSize: 13}}>
                      <label style={{display: 'flex', alignItems: 'center', padding: '4px 12px', cursor: 'pointer'}}>
                        <input type="checkbox" checked={visibleColumns.updated} onChange={(e) => setVisibleColumns({...visibleColumns, updated: e.target.checked})} style={{marginRight: 8}} /> Updated
                      </label>
                      <label style={{display: 'flex', alignItems: 'center', padding: '4px 12px', cursor: 'pointer'}}>
                        <input type="checkbox" checked={visibleColumns.mse} onChange={(e) => setVisibleColumns({...visibleColumns, mse: e.target.checked})} style={{marginRight: 8}} /> MSE
                      </label>
                      <label style={{display: 'flex', alignItems: 'center', padding: '4px 12px', cursor: 'pointer'}}>
                        <input type="checkbox" checked={visibleColumns.sensitivity} onChange={(e) => setVisibleColumns({...visibleColumns, sensitivity: e.target.checked})} style={{marginRight: 8}} /> Sensitivity
                      </label>
                      <label style={{display: 'flex', alignItems: 'center', padding: '4px 12px', cursor: 'pointer'}}>
                        <input type="checkbox" checked={visibleColumns.scanFile} onChange={(e) => setVisibleColumns({...visibleColumns, scanFile: e.target.checked})} style={{marginRight: 8}} /> Scan file
                      </label>
                    </div>
                  )}
                </div>
                <div style={{marginTop: 64, display: 'flex', flexDirection: 'column', gap: 8}}>
                  <button 
                    className="btn" 
                    style={{flexDirection: 'column', padding: '8px', height: 'auto'}} 
                    disabled={selectedRowIndex === null}
                    onClick={() => setIsZoomsOpen(true)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                    <span style={{fontSize: 11}}>Zooms</span>
                  </button>
                  <button 
                    className="btn" 
                    style={{flexDirection: 'column', padding: '8px', height: 'auto'}} 
                    disabled={selectedRowIndex === null}
                    onClick={handleOpenLayout}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                    <span style={{fontSize: 11}}>Layout</span>
                  </button>
                  <button 
                    className="btn" 
                    style={{flexDirection: 'column', padding: '8px', height: 'auto'}} 
                    disabled={selectedRowIndex === null}
                    onClick={handleRemoveCapture}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                    <span style={{fontSize: 11}}>Remove</span>
                  </button>
                </div>
              </div>

              {/* Right panel */}
              <div style={{flex: 1, border: '1px solid var(--border-color)', background: 'white', position: 'relative', overflow: 'hidden'}}>
                {isZoomsOpen && selectedRowIndex !== null && captureData[selectedRowIndex] ? (
                  <div style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'white', zIndex: 10, display: 'flex', flexDirection: 'column'}}>
                    {/* Header bar 1: Toolbar */}
                    <div style={{display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderBottom: '1px solid #ccc', background: '#e5e2df', alignItems: 'center'}}>
                      <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                        <div style={{ position: 'relative' }}>
                          <button 
                            className="btn" 
                            style={{ fontSize: 12, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4, background: 'white' }}
                            onClick={() => setShowZoomsModeMenu(!showZoomsModeMenu)}
                          >
                            <span>{zoomsMode}</span>
                            <span style={{ fontSize: 9 }}>▼</span>
                          </button>
                          {showZoomsModeMenu && (
                            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 2, background: 'white', border: '1px solid #ccc', borderRadius: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 100, minWidth: 120 }}>
                              <div 
                                style={{ padding: '6px 12px', fontSize: 12, cursor: 'pointer', background: zoomsMode === 'drag and drop' ? '#e0f2fe' : 'transparent' }}
                                onClick={() => { setZoomsMode('drag and drop'); setShowZoomsModeMenu(false); }}
                              >
                                drag and drop
                              </div>
                              <div 
                                style={{ padding: '6px 12px', fontSize: 12, cursor: 'pointer', background: zoomsMode === 'click' ? '#e0f2fe' : 'transparent' }}
                                onClick={() => { setZoomsMode('click'); setShowZoomsModeMenu(false); }}
                              >
                                click
                              </div>
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: 2 }}>
                          <button 
                            className="btn" 
                            style={{ padding: '2px 8px', fontSize: 13, background: 'white', fontWeight: 'bold' }} 
                            title="Zoom out"
                            disabled={zoomsBoxSize <= 32}
                            onClick={() => setZoomsBoxSize(prev => Math.max(32, prev - 8))}
                          >
                            −
                          </button>
                          <button 
                            className="btn" 
                            style={{ padding: '2px 8px', fontSize: 13, background: 'white', fontWeight: 'bold' }} 
                            title="Zoom in"
                            disabled={zoomsBoxSize >= 96}
                            onClick={() => setZoomsBoxSize(prev => Math.min(96, prev + 8))}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div style={{fontWeight: 'bold', fontSize: 13}}>Zooms</div>

                      <button className="btn" style={{ padding: '3px 12px', fontSize: 12, background: 'white' }} onClick={() => setIsZoomsOpen(false)}>Close</button>
                    </div>

                    {/* Header bar 2: Navigation */}
                    <div style={{display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderBottom: '1px solid #eee', background: '#fafafa', alignItems: 'center'}}>
                      <button className="btn" style={{ padding: '3px 12px', fontSize: 12 }} onClick={() => setSelectedRowIndex(Math.max(0, selectedRowIndex - 1))} disabled={selectedRowIndex === 0}>Back</button>
                      <div style={{fontWeight: 600, fontSize: 13}}>Boxes zooms for page {captureData[selectedRowIndex].identifier}</div>
                      <button className="btn" style={{ padding: '3px 12px', fontSize: 12 }} onClick={() => setSelectedRowIndex(Math.min(captureData.length - 1, selectedRowIndex + 1))} disabled={selectedRowIndex === captureData.length - 1}>Forward</button>
                    </div>

                    <div style={{flex: 1, overflowY: 'auto'}}>
                      {/* Unchecked boxes */}
                      <div style={{padding: 8, textAlign: 'center', fontWeight: 'bold', color: 'var(--text-muted)', borderBottom: '1px solid #eee', background: '#fafafa'}}>
                        Unchecked boxes
                      </div>
                      <div 
                        style={{
                          padding: 16,
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 16,
                          minHeight: 90,
                          background: isOverUnchecked ? '#f0f9ff' : 'transparent',
                          border: isOverUnchecked ? '2px dashed #0284c7' : '2px dashed transparent',
                          borderRadius: 4,
                          transition: 'background 0.2s, border 0.2s'
                        }}
                        onDragOver={(e) => { e.preventDefault(); setIsOverUnchecked(true); }}
                        onDragLeave={() => setIsOverUnchecked(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsOverUnchecked(false);
                          handleDropOnZone(false);
                        }}
                      >
                        {zoomsData.filter(b => !b.checked).map((b) => (
                          <div 
                            key={`${b.id_a}-${b.id_b}`} 
                            draggable={zoomsMode === 'drag and drop'}
                            onDragStart={(e) => handleDragStart(e, b)}
                            onClick={() => handleToggleZoomBox(b)}
                            style={{
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: 4, 
                              cursor: 'pointer',
                              padding: 3,
                              borderRadius: 4,
                              userSelect: 'none',
                              transition: 'transform 0.1s, box-shadow 0.1s',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                            title="Click hoặc kéo để chuyển sang Checked"
                          >
                             <img 
                               src={`data:image/png;base64,${b.image}`} 
                               alt="box" 
                               draggable={false}
                               style={{
                                 border: '2px solid #0000ff', 
                                 padding: 2, 
                                 background: 'white', 
                                 width: zoomsBoxSize, 
                                 height: zoomsBoxSize,
                                 objectFit: 'contain',
                                 pointerEvents: 'none',
                                 userSelect: 'none'
                               }} 
                             />
                             <span style={{color: '#999', fontSize: 12, pointerEvents: 'none', userSelect: 'none'}}>{b.ratio.toFixed(3)}</span>
                          </div>
                        ))}
                        {zoomsData.filter(b => !b.checked).length === 0 && (
                          <div style={{color: '#aaa', fontSize: 13, padding: 16, fontStyle: 'italic', width: '100%', textAlign: 'center'}}>
                            No unchecked boxes
                          </div>
                        )}
                      </div>
                      
                      {/* Checked boxes */}
                      <div style={{padding: 8, textAlign: 'center', fontWeight: 'bold', color: 'var(--text-muted)', borderBottom: '1px solid #eee', borderTop: '1px solid #ccc', background: '#fafafa'}}>
                        Checked boxes
                      </div>
                      <div 
                        style={{
                          padding: 16,
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 16,
                          minHeight: 90,
                          background: isOverChecked ? '#fdf2f8' : 'transparent',
                          border: isOverChecked ? '2px dashed #db2777' : '2px dashed transparent',
                          borderRadius: 4,
                          transition: 'background 0.2s, border 0.2s'
                        }}
                        onDragOver={(e) => { e.preventDefault(); setIsOverChecked(true); }}
                        onDragLeave={() => setIsOverChecked(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsOverChecked(false);
                          handleDropOnZone(true);
                        }}
                      >
                        {zoomsData.filter(b => b.checked).map((b) => (
                          <div 
                            key={`${b.id_a}-${b.id_b}`} 
                            draggable={zoomsMode === 'drag and drop'}
                            onDragStart={(e) => handleDragStart(e, b)}
                            onClick={() => handleToggleZoomBox(b)}
                            style={{
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: 4, 
                              cursor: 'pointer',
                              padding: 3,
                              borderRadius: 4,
                              userSelect: 'none',
                              transition: 'transform 0.1s, box-shadow 0.1s',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                            title="Click hoặc kéo để chuyển sang Unchecked"
                          >
                             <img 
                               src={`data:image/png;base64,${b.image}`} 
                               alt="box" 
                               draggable={false}
                               style={{
                                 border: '2px solid #ff00ff', 
                                 padding: 2, 
                                 background: 'white', 
                                 width: zoomsBoxSize, 
                                 height: zoomsBoxSize,
                                 objectFit: 'contain',
                                 pointerEvents: 'none',
                                 userSelect: 'none'
                               }} 
                             />
                             <span style={{color: '#999', fontSize: 12, pointerEvents: 'none', userSelect: 'none'}}>{b.ratio.toFixed(3)}</span>
                          </div>
                        ))}
                        {zoomsData.filter(b => b.checked).length === 0 && (
                          <div style={{color: '#aaa', fontSize: 13, padding: 16, fontStyle: 'italic', width: '100%', textAlign: 'center'}}>
                            No checked boxes
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)'}}>
                    Pages:
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
        {activeTab === 'Reports' && (
          <div className="reports-panel">
            <section className="reports-section">
              <h2>Marks export</h2>
              <div className="reports-export-row">
                <select aria-label="Export format"><option>CSV</option></select>
                <button className="marking-button reports-export-button" onClick={handleMarksExport} disabled={isExportingMarks}>▤ {isExportingMarks ? 'Exporting…' : 'Export'}</button>
              </div>
              <div className="reports-field"><label htmlFor="report-sorting">Sorting:</label><select id="report-sorting" value={reportSorting} onChange={(event) => setReportSorting(event.target.value)}>
                <option value="name">name</option><option value="exam_copy_number">exam copy number</option><option value="line_in_students_list">line in students' list</option><option value="mark_ascending">mark (ascending)</option><option value="mark_descending">mark (descending)</option>
              </select></div>
              <label className="reports-check" style={{ cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={includeAbsentees} 
                  onChange={(e) => setIncludeAbsentees(e.target.checked)} 
                /> include absentees
              </label>
              <div className="reports-field"><label>Separator:</label><select value={reportSeparator} onChange={(event) => setReportSeparator(event.target.value)}><option value=";">;</option><option value=",">,</option></select></div>
              <div style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    if (!studentsListFile) {
                      alert('Please set a students list CSV first in Marking tab.');
                      return;
                    }
                    setIsChooseColumnsOpen(true);
                  }}
                  style={{ fontSize: 12, padding: '4px 14px' }}
                >
                  Choose columns
                </button>
              </div>
            </section>
            <section className="reports-section reports-annotated-section">
              <h2>Annotated papers</h2>
              <select value={annotationMode} onChange={(event) => setAnnotationMode(event.target.value)}><option value="per_student">One file per student</option><option value="all_students">One file for all students</option></select>
              <div className="reports-file-name">
                <label htmlFor="report-filename-model">File name model:</label>
                <input 
                  id="report-filename-model"
                  type="text" 
                  value={filenameModel} 
                  onChange={(event) => setFilenameModel(event.target.value)} 
                  disabled={annotationMode !== 'per_student'}
                  placeholder="(N)-(ID)"
                  title="File name model used to make file names for PDF annotated papers, one by student. Keep empty in order to use (N)-(ID)."
                />
              </div>
              <label className="reports-check"><input type="checkbox" checked={includeSubjectPages} onChange={(event) => setIncludeSubjectPages(event.target.checked)} /> Insert pages from the subject when needed</label>
              <div className="reports-annotated-actions"><select value={annotationScope} onChange={(event) => handleAnnotationScope(event.target.value)}><option value="all_students">All students</option><option value="selected_students">Selected students</option></select><button className="marking-button" onClick={handleAnnotatePapers} disabled={isAnnotating}>✎ {isAnnotating ? 'Annotating…' : 'Annotate papers'}</button></div>
              {annotationScope === 'selected_students' && <div className="reports-student-selector">
                <strong>Select students</strong>
                {annotationCandidates.map((student) => <label key={student.value}><input type="checkbox" checked={selectedAnnotationValues.includes(student.value)} onChange={(event) => setSelectedAnnotationValues((current) => event.target.checked ? [...current, student.value] : current.filter((value) => value !== student.value))} /> <span>{student.value}</span><span>{student.name} {student.forename}</span></label>)}
              </div>}
              <button
                className="marking-button reports-send-button"
                onClick={() => setIsMailingOpen(true)}
                disabled={!currentProject}
                title={!currentProject ? "Vui lòng mở một dự án trước" : "Gửi email kết quả bài làm cho học sinh"}
              >
                ↗ Send…
              </button>
            </section>
          </div>
        )}
      </div>

      <div style={{padding: '4px 16px', background: 'var(--bg-toolbar)', borderTop: '1px solid var(--border-color)', fontSize: 12}}>
        › Command output details
      </div>

      {/* Modals */}
      <OpenProjectModal 
        isOpen={isOpenProjectOpen} 
        onClose={() => setOpenProjectOpen(false)}
        onSelect={(proj) => {
          setCurrentProject(proj.name);
          setOpenProjectOpen(false);
        }}
      />

      <ManageProjectsModal
        isOpen={isManageProjectsOpen}
        onClose={() => setManageProjectsOpen(false)}
        onProjectAction={() => {
          // You can handle side effects here if needed when project is deleted/renamed
          if (currentProject) {
            // Check if current project still exists or was renamed
          }
        }}
      />

      <SaveAsTemplateModal
        isOpen={isSaveTemplateOpen}
        onClose={() => setSaveTemplateOpen(false)}
        projectName={currentProject || ''}
      />

      <CleanupModal
        isOpen={isCleanupOpen}
        onClose={() => setCleanupOpen(false)}
        projectName={currentProject || ''}
      />

      <CreateProjectModal 
        isOpen={isCreateOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(name) => {
          setCurrentProject(name);
          setCreateOpen(false);
        }}
      />

      <LatexEditorModal
        isOpen={isEditorOpen}
        projectName={currentProject || ''}
        requestedFormat={sourceFormat}
        onClose={() => setEditorOpen(false)}
      />
      
      <ManualCaptureModal
        isOpen={isManualModalOpen}
        projectName={currentProject || ''}
        onClose={() => setIsManualModalOpen(false)}
      />

      <ManualAssociationModal
        isOpen={isManualAssociationOpen}
        projectName={currentProject || ''}
        csvFile={studentsListFile}
        primaryKey={primaryKey}
        onClose={() => setIsManualAssociationOpen(false)}
        onUpdated={fetchIdentificationStatus}
      />

      <CsvEditorModal
        isOpen={isCsvEditorOpen}
        projectName={currentProject || ''}
        csvFile={studentsListFile}
        onClose={() => setIsCsvEditorOpen(false)}
        onSaved={(headers) => {
          setCsvHeaders(headers);
          setPrimaryKey((current) => current && headers.includes(current) ? current : headers[0] || null);
        }}
      />

      <PreferencesModal
        isOpen={isPreferencesOpen}
        onClose={() => setPreferencesOpen(false)}
        onPreferencesSaved={setAppPreferences}
        currentProject={currentProject}
      />

      <MailingModal
        mode="annotated"
        isOpen={isMailingOpen}
        onClose={() => setIsMailingOpen(false)}
        projectName={currentProject || ''}
        csvFile={studentsListFile || ''}
        primaryKey={primaryKey || ''}
      />

      <MailingModal
        mode="subject"
        isOpen={isPrepMailingOpen}
        onClose={() => setIsPrepMailingOpen(false)}
        projectName={currentProject || ''}
        csvFile={studentsListFile || ''}
        primaryKey={primaryKey || ''}
      />

      <UnrecognizedScansModal
        isOpen={isUnrecognizedModalOpen}
        onClose={() => setIsUnrecognizedModalOpen(false)}
        projectName={currentProject || ''}
        onScanDeleted={fetchCaptureData}
      />

      <PostcorrectModal
        isOpen={isPostcorrectModalOpen}
        onClose={() => setIsPostcorrectModalOpen(false)}
        projectName={currentProject || ''}
        sheets={postcorrectData?.sheets || []}
        defaultStudent={postcorrectData?.default_student ?? 1}
        defaultCopy={postcorrectData?.default_copy ?? 0}
        defaultSetMultiple={postcorrectData?.default_set_multiple ?? true}
        onApply={handleApplyPostcorrect}
      />

      <MarksModal
        isOpen={isMarksModalOpen}
        onClose={() => setIsMarksModalOpen(false)}
        projectName={currentProject || ''}
      />

      <ChooseColumnsModal
        isOpen={isChooseColumnsOpen}
        onClose={() => setIsChooseColumnsOpen(false)}
        availableCsvHeaders={csvHeaders}
        initialSelectedColumns={exportColumns}
        onSave={(cols) => setExportColumns(cols)}
      />

      {completionNotification && <div className="completion-notification" role="status">{completionNotification}</div>}

      {isLayoutOpen && layoutImageUrl && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1000, display: 'flex', flexDirection: 'column'}}>
          <div style={{padding: 16, display: 'flex', justifyContent: 'flex-end'}}>
            <button className="btn" style={{background: 'transparent', color: 'white', border: '1px solid white'}} onClick={() => setIsLayoutOpen(false)}>Close</button>
          </div>
          <div style={{flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 16}}>
            <img src={layoutImageUrl} alt="Layout" style={{maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', background: 'white'}} />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

