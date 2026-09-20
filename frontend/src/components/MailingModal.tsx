import React, { useState, useEffect } from 'react';
import '../index.css';

interface StudentPreview {
  exam: number;
  copy: number;
  sc: string;
  id: string;
  name: string;
  email: string;
  email_values: Record<string, string>;
  status: 'done' | 'failed' | '';
  mail_message: string;
  has_pdf: boolean;
  mark?: number;
  max_mark?: number;
}

interface MailingModalProps {
  mode?: 'annotated' | 'subject';
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  csvFile?: string;
  primaryKey?: string;
  onMailingCompleted?: () => void;
}

export const MailingModal: React.FC<MailingModalProps> = ({
  mode = 'annotated',
  isOpen,
  onClose,
  projectName,
  csvFile,
  primaryKey,
  onMailingCompleted,
}) => {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [prerequisiteError, setPrerequisiteError] = useState<{
    code: string;
    message: string;
  } | null>(null);

  const [currentCsvFile, setCurrentCsvFile] = useState(csvFile || '');
  const [currentPrimaryKey, setCurrentPrimaryKey] = useState(primaryKey || '');
  const [availableCsvs, setAvailableCsvs] = useState<string[]>([]);

  const [examName, setExamName] = useState('');
  const [isEditingExamName, setIsEditingExamName] = useState(false);
  const [emailColumns, setEmailColumns] = useState<string[]>([]);
  const [selectedEmailCol, setSelectedEmailCol] = useState<string>('');
  const [students, setStudents] = useState<StudentPreview[]>([]);
  const [selectedExams, setSelectedExams] = useState<Set<number>>(new Set());

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [useHtml, setUseHtml] = useState(false);

  const [availableFiles, setAvailableFiles] = useState<string[]>([]);
  const [selectedAttachments, setSelectedAttachments] = useState<string[]>([]);
  const [showAttachments, setShowAttachments] = useState(false);

  const [resultDialog, setResultDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    isError: boolean;
    failures: Array<{ exam: number; name?: string; email?: string; error: string }>;
  } | null>(null);

  const loadPreview = async (overrideCsv?: string) => {
    if (!projectName) return;
    setLoading(true);
    setPrerequisiteError(null);
    try {
      const endpointPrefix = mode === 'subject' ? 'preparation' : 'reports';
      const fileToUse = overrideCsv ?? (currentCsvFile || csvFile || '');
      const pkToUse = currentPrimaryKey || primaryKey || '';
      const params = new URLSearchParams();
      if (fileToUse) params.set('csv_file', fileToUse);
      if (pkToUse) params.set('primary_key', pkToUse);
      const qs = params.toString() ? `?${params.toString()}` : '';

      const url = `http://localhost:8000/api/projects/${encodeURIComponent(
        projectName
      )}/${endpointPrefix}/mailing/preview${qs}`;

      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'Không thể tải dữ liệu gửi thư.');
      }

      if (data.status === 'error') {
        setPrerequisiteError({
          code: data.code || 'ERROR',
          message: data.message || 'Chưa đủ điều kiện gửi email.',
        });
        setLoading(false);
        return;
      }

      if (data.csv_file) setCurrentCsvFile(data.csv_file);
      if (data.primary_key) setCurrentPrimaryKey(data.primary_key);
      if (data.available_csvs) setAvailableCsvs(data.available_csvs);

      setExamName(data.exam_name || projectName);
      setEmailColumns(data.email_columns || []);
      const defaultCol = data.default_email_col || (data.email_columns?.[0] ?? '');
      setSelectedEmailCol(defaultCol);
      setSubject(data.default_subject || (mode === 'subject' ? 'Exam question' : 'Exam result'));
      setBody(data.default_body || (mode === 'subject' ? 'Please find enclosed your question sheet.\nRegards.' : 'Please find enclosed your annotated completed answer sheet.\nRegards.'));
      setUseHtml(!!data.use_html);
      setAvailableFiles(data.available_files || []);

      const list: StudentPreview[] = data.students || [];
      setStudents(list);

      // Default select all students
      setSelectedExams(new Set(list.map((s) => s.exam)));
    } catch (err) {
      setPrerequisiteError({
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Không thể kết nối đến máy chủ backend.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setCurrentCsvFile(csvFile || '');
      setCurrentPrimaryKey(primaryKey || '');
      void loadPreview(csvFile || undefined);
    } else {
      setResultDialog(null);
      setSending(false);
    }
  }, [isOpen, projectName, csvFile, primaryKey, mode]);

  if (!isOpen) return null;

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedExams(new Set(students.map((s) => s.exam)));
    } else {
      setSelectedExams(new Set());
    }
  };

  const handleToggleStudent = (exam: number) => {
    setSelectedExams((prev) => {
      const next = new Set(prev);
      if (next.has(exam)) {
        next.delete(exam);
      } else {
        next.add(exam);
      }
      return next;
    });
  };

  const handleSelectFailed = () => {
    const failedExams = students.filter((s) => s.status === 'failed').map((s) => s.exam);
    if (failedExams.length === 0) {
      alert('Không có học sinh nào có trạng thái thất bại (failed) từ lần gửi trước.');
      return;
    }
    setSelectedExams(new Set(failedExams));
  };

  const handleSend = async () => {
    if (selectedExams.size === 0) {
      alert('Vui lòng chọn ít nhất 1 học sinh để gửi email.');
      return;
    }

    const selectedList = students.filter((s) => selectedExams.has(s.exam));
    const validRecipients = selectedList.filter((s) => {
      const email = s.email_values?.[selectedEmailCol] || s.email;
      return email && email.includes('@');
    });

    if (validRecipients.length === 0) {
      alert(`Không có học sinh nào có địa chỉ email hợp lệ trong cột "${selectedEmailCol}".`);
      return;
    }

    const confirmText =
      mode === 'subject'
        ? `Bạn có chắc chắn muốn gửi đề thi tới ${validRecipients.length} học sinh đã chọn không?`
        : `Bạn có chắc chắn muốn gửi email kết quả bài thi tới ${validRecipients.length} học sinh đã chọn không?`;

    if (!window.confirm(confirmText)) {
      return;
    }

    setSending(true);
    try {
      const endpointPrefix = mode === 'subject' ? 'preparation' : 'reports';
      const res = await fetch(
        `http://localhost:8000/api/projects/${encodeURIComponent(projectName)}/${endpointPrefix}/mailing/send`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            csv_file: currentCsvFile || csvFile,
            primary_key: currentPrimaryKey || primaryKey,
            email_col: selectedEmailCol,
            exam_name: examName,
            subject: subject,
            body: body,
            use_html: useHtml,
            selected_exams: Array.from(selectedExams),
            attachments: selectedAttachments,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Quá trình gửi email gặp lỗi.');
      }

      setResultDialog({
        isOpen: true,
        title: data.failed_auth
          ? 'Lỗi xác thực SMTP'
          : data.failed_count > 0
          ? 'Gửi hoàn tất với một số lỗi'
          : 'Gửi email thành công',
        message: data.message || `${data.sent_count} thư đã được gửi.`,
        isError: data.failed_auth || (data.failed_count > 0 && data.sent_count === 0),
        failures: data.failures || [],
      });

      // Reload preview to update statuses
      void loadPreview();
      onMailingCompleted?.();
    } catch (err) {
      setResultDialog({
        isOpen: true,
        title: 'Lỗi gửi email',
        message: err instanceof Error ? err.message : 'Không thể hoàn tất việc gửi thư.',
        isError: true,
        failures: [],
      });
    } finally {
      setSending(false);
    }
  };

  const isAllSelected = students.length > 0 && selectedExams.size === students.length;
  const failedCount = students.filter((s) => s.status === 'failed').length;

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal mailing-modal" style={{ width: '850px', maxWidth: '95vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div className="modal-header" style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="modal-title" style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
            {mode === 'subject' ? '↗ Send question sheets to students' : '↗ Send emails to students'}
          </h3>
          <button
            onClick={onClose}
            className="btn-icon"
            style={{ border: 'none', background: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--text-muted)' }}
            disabled={sending}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ padding: '16px 18px', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <div className="spinner" style={{ marginBottom: '10px' }} />
              Đang kiểm tra điều kiện và tải danh sách học sinh...
            </div>
          ) : prerequisiteError ? (
            <div className="mailing-prereq-error" style={{ padding: '16px', background: '#fff5f5', border: '1px solid #ffc9c9', borderRadius: '6px', color: '#c92a2a' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>⚠️</span>
                <div>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: 600 }}>Không thể mở hộp thoại gửi email</h4>
                  <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5 }}>{prerequisiteError.message}</p>
                  <div style={{ marginTop: '14px', fontSize: '13px', color: '#495057' }}>
                    {(prerequisiteError.code === 'NO_QUESTION_PDF' || prerequisiteError.code === 'NO_SUBJECT_PDF') && (
                      <p style={{ margin: 0 }}>
                        💡 <b>Hướng dẫn:</b> Hãy cập nhật tài liệu (bấm nút <b>"Update documents"</b>) và phát hiện bố cục (<b>"Layout detection"</b>) ở tab Preparation trước khi gửi đề thi.
                      </p>
                    )}
                    {prerequisiteError.code === 'NO_ANNOTATED_PDFS' && (
                      <p style={{ margin: 0 }}>
                        💡 <b>Hướng dẫn:</b> Hãy hoàn thành bước chấm bài và tạo bài chấm (bấm nút <b>"Annotate papers"</b>) trước khi gửi kết quả.
                      </p>
                    )}
                    {prerequisiteError.code === 'INVALID_SENDER_EMAIL' && (
                      <p style={{ margin: 0 }}>
                        💡 <b>Hướng dẫn:</b> Vào thanh menu <b>Edit → Preferences → tab Email</b> để điền địa chỉ <i>Email người gửi</i> và lưu lại.
                      </p>
                    )}
                    {prerequisiteError.code === 'NO_CSV_FILE' && (
                      <p style={{ margin: 0 }}>
                        💡 <b>Hướng dẫn:</b> Hãy tải lên file danh sách học sinh (.csv) ở tab <b>Marking</b> hoặc đặt file <code>list.csv</code> vào thư mục dự án.
                      </p>
                    )}
                    {prerequisiteError.code === 'NO_EMAIL_COLUMN' && (
                      <p style={{ margin: 0 }}>
                        💡 <b>Hướng dẫn:</b> Mở file danh sách học sinh CSV của đề thi và bổ sung thêm một cột (ví dụ: <code>email</code>) chứa hòm thư của học sinh.
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: '16px', textAlign: 'right' }}>
                <button className="btn" onClick={onClose} style={{ background: '#fff' }}>
                  Đóng
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Exam Name (%n) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'var(--bg-toolbar)', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                  Current project name %n:
                </label>
                {isEditingExamName ? (
                  <div style={{ display: 'flex', gap: '6px', flex: 1 }}>
                    <input
                      type="text"
                      className="input-field"
                      style={{ padding: '4px 8px', fontSize: '13px' }}
                      value={examName}
                      onChange={(e) => setExamName(e.target.value)}
                    />
                    <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => setIsEditingExamName(false)}>
                      OK
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                    <span style={{ fontSize: '13px', fontWeight: 500 }}>{examName || projectName}</span>
                    <button
                      className="btn"
                      style={{ padding: '2px 8px', fontSize: '11px', height: 'auto' }}
                      onClick={() => setIsEditingExamName(true)}
                      title="Chỉnh sửa tên hiển thị cho biến %n"
                    >
                      ✎ Edit
                    </button>
                  </div>
                )}
              </div>

              {/* Addressees Frame */}
              <div className="mailing-frame" style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '12px', background: 'var(--bg-surface)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    {availableCsvs.length > 1 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <label style={{ fontSize: '13px', fontWeight: 600 }}>CSV file:</label>
                        <select
                          value={currentCsvFile}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCurrentCsvFile(val);
                            void loadPreview(val);
                          }}
                          style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '13px' }}
                        >
                          {availableCsvs.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : currentCsvFile ? (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        File: <b>{currentCsvFile}</b>
                      </div>
                    ) : null}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <label style={{ fontSize: '13px', fontWeight: 600 }}>Emails column:</label>
                      <select
                        value={selectedEmailCol}
                        onChange={(e) => setSelectedEmailCol(e.target.value)}
                        style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '13px' }}
                      >
                        {emailColumns.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      className="btn"
                      onClick={handleSelectFailed}
                      style={{ fontSize: '12px', padding: '4px 10px', color: failedCount > 0 ? '#d9480f' : 'inherit' }}
                      title="Chỉ chọn những học sinh bị lỗi ở lần gửi trước"
                    >
                      Select failed {failedCount > 0 ? `(${failedCount})` : ''}
                    </button>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Đã chọn: <b>{selectedExams.size}</b> / {students.length}
                    </span>
                  </div>
                </div>

                {/* Table */}
                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                    <thead style={{ background: 'var(--bg-toolbar)', position: 'sticky', top: 0, zIndex: 1 }}>
                      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '6px 8px', width: '32px', textAlign: 'center' }}>
                          <input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} />
                        </th>
                        <th style={{ padding: '6px 8px', width: '60px' }}>Copy</th>
                        <th style={{ padding: '6px 8px' }}>Name</th>
                        <th style={{ padding: '6px 8px' }}>Email</th>
                        <th style={{ padding: '6px 8px', width: '90px', textAlign: 'center' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((st) => {
                        const currentEmail = st.email_values?.[selectedEmailCol] || st.email || '';
                        const isSelected = selectedExams.has(st.exam);
                        return (
                          <tr
                            key={`${st.exam}-${st.copy}`}
                            style={{
                              borderBottom: '1px solid var(--border-color)',
                              background: isSelected ? 'rgba(51, 154, 240, 0.04)' : 'transparent',
                            }}
                          >
                            <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleStudent(st.exam)}
                              />
                            </td>
                            <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{st.sc}</td>
                            <td style={{ padding: '6px 8px', fontWeight: 500 }}>{st.name}</td>
                            <td style={{ padding: '6px 8px', color: currentEmail ? 'var(--text-main)' : '#fa5252' }}>
                              {currentEmail || <i>(Trống)</i>}
                            </td>
                            <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                              {st.status === 'done' && (
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '2px 8px',
                                    borderRadius: '10px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    background: '#ebfbee',
                                    color: '#2b8a3e',
                                  }}
                                >
                                  ✓ done
                                </span>
                              )}
                              {st.status === 'failed' && (
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '2px 8px',
                                    borderRadius: '10px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    background: '#fff5f5',
                                    color: '#e03131',
                                    cursor: st.mail_message ? 'help' : 'default',
                                  }}
                                  title={st.mail_message || 'Gửi thất bại'}
                                >
                                  ✕ failed
                                </span>
                              )}
                              {!st.status && <span style={{ color: 'var(--text-muted)' }}>—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Subject Frame */}
              <div className="mailing-frame" style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px 12px', background: 'var(--bg-surface)' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Subject
                </label>
                <input
                  type="text"
                  className="input-field"
                  style={{ fontSize: '13px', padding: '6px 10px' }}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={mode === 'subject' ? 'Exam question - %n' : 'Exam result - %n'}
                />
              </div>

              {/* Body Frame */}
              <div className="mailing-frame" style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px 12px', background: 'var(--bg-surface)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>Body</label>
                  <label style={{ fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      type="checkbox"
                      checked={useHtml}
                      onChange={(e) => setUseHtml(e.target.checked)}
                    />
                    HTML format
                  </label>
                </div>
                <textarea
                  className="input-field"
                  rows={4}
                  style={{ fontSize: '13px', padding: '8px 10px', resize: 'vertical' }}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
                <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5, background: 'var(--bg-toolbar)', padding: '6px 10px', borderRadius: '4px' }}>
                  {mode === 'subject' ? (
                    <>
                      <b>Các biến hỗ trợ:</b> <code>%n</code>: Tên kỳ thi,{' '}
                      <code>%(cột)</code>: Dữ liệu cột CSV (ví dụ: <code>%(name)</code>, <code>%(id)</code>).
                    </>
                  ) : (
                    <>
                      <b>Các biến hỗ trợ:</b> <code>%s</code>: Điểm bài thi, <code>%m</code>: Điểm tối đa,{' '}
                      <code>%S</code>: Tổng điểm câu, <code>%M</code>: Điểm câu tối đa, <code>%n</code>: Tên kỳ thi,{' '}
                      <code>%(cột)</code>: Dữ liệu cột CSV (ví dụ: <code>%(name)</code>, <code>%(id)</code>).
                    </>
                  )}
                </div>
              </div>

              {/* Attachments Expander */}
              <div className="mailing-frame" style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px 12px', background: 'var(--bg-surface)' }}>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => setShowAttachments(!showAttachments)}
                >
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>
                    {showAttachments ? '▾' : '▸'} Additional Attachments{' '}
                    <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'var(--text-muted)' }}>
                      (Bên cạnh file {mode === 'subject' ? 'đề thi cá nhân' : 'cá nhân'} <code>{mode === 'subject' ? 'subject.pdf' : 'corrected.pdf'}</code>)
                    </span>
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--primary-color)' }}>
                    {selectedAttachments.length > 0 ? `${selectedAttachments.length} file đã chọn` : 'Không có'}
                  </span>
                </div>

                {showAttachments && (
                  <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed var(--border-color)' }}>
                    {availableFiles.length === 0 ? (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Không có tệp PDF bổ sung nào trong thư mục bài thi.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {availableFiles.map((file) => (
                          <label key={file} style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={selectedAttachments.includes(file)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedAttachments([...selectedAttachments, file]);
                                } else {
                                  setSelectedAttachments(selectedAttachments.filter((f) => f !== file));
                                }
                              }}
                            />
                            <span>{file}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ padding: '12px 18px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '8px', background: 'var(--bg-toolbar)' }}>
          <button className="btn" onClick={onClose} disabled={sending}>
            Hủy
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSend}
            disabled={loading || sending || !!prerequisiteError || selectedExams.size === 0}
            style={{ minWidth: '110px' }}
          >
            {sending ? 'Đang gửi...' : (mode === 'subject' ? '↗ Gửi đề thi' : '↗ Gửi email')}
          </button>
        </div>
      </div>

      {/* Result Dialog Modal */}
      {resultDialog?.isOpen && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal" style={{ width: '500px', maxWidth: '90vw' }}>
            <div className="modal-header" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
              <h4 style={{ margin: 0, fontSize: '15px', color: resultDialog.isError ? '#c92a2a' : 'inherit' }}>
                {resultDialog.title}
              </h4>
            </div>
            <div className="modal-body" style={{ padding: '16px', fontSize: '14px' }}>
              <p style={{ margin: '0 0 10px 0' }}>{resultDialog.message}</p>
              {resultDialog.failures && resultDialog.failures.length > 0 && (
                <div style={{ marginTop: '10px', maxHeight: '160px', overflowY: 'auto', background: '#fff5f5', border: '1px solid #ffc9c9', borderRadius: '4px', padding: '8px 10px', fontSize: '12px' }}>
                  <b style={{ color: '#c92a2a' }}>Chi tiết các bài gửi không thành công:</b>
                  <ul style={{ margin: '6px 0 0 0', paddingLeft: '18px' }}>
                    {resultDialog.failures.map((f, i) => (
                      <li key={i} style={{ marginBottom: '4px' }}>
                        Bài {f.exam} ({f.name || f.email || 'Học sinh'}): {f.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ padding: '10px 16px', textAlign: 'right', borderTop: '1px solid var(--border-color)' }}>
              <button
                className="btn btn-primary"
                onClick={() => setResultDialog(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
