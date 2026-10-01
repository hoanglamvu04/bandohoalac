import { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  Building2,
  Coins,
  ExternalLink,
  Save,
  Search,
  Shield,
  Store,
  UserCog,
  UserPlus,
  Users
} from 'lucide-react';
import {
  adjustAdminUserWallet,
  assignAdminUserPartnerAccess,
  getAdminPartners,
  getAdminUser,
  getAdminUsers,
  updateAdminUser,
  updateAdminUserPartnerAccess
} from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

const EMPTY_FILTERS = { q: '', role: 'ALL', accountStatus: 'ALL' };

function toForm(user) {
  return {
    name: user?.name || '',
    email: user?.email || '',
    bio: user?.bio || '',
    role: user?.role || 'USER',
    accountStatus: user?.accountStatus || 'ACTIVE'
  };
}

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [form, setForm] = useState(toForm(null));
  const [walletAmount, setWalletAmount] = useState('');
  const [walletReason, setWalletReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [partnerOptions, setPartnerOptions] = useState([]);
  const [partnerAssign, setPartnerAssign] = useState({ partnerId: '', role: 'STAFF' });
  const [partnerSaving, setPartnerSaving] = useState(false);
  const [partnerUpdatingId, setPartnerUpdatingId] = useState(null);

  const selected = useMemo(
    () => selectedDetail
      || items.find((item) => String(item.id) === String(selectedId))
      || null,
    [items, selectedId, selectedDetail]
  );

  async function load(nextFilters = filters) {
    setLoading(true);
    try {
      const data = await getAdminUsers({
        q: nextFilters.q.trim() || undefined,
        role: nextFilters.role,
        accountStatus: nextFilters.accountStatus,
        limit: 100
      });
      const nextItems = Array.isArray(data?.items) ? data.items : [];
      setItems(nextItems);

      if (selectedId) {
        const refreshed = nextItems.find((item) => String(item.id) === String(selectedId));
        if (refreshed && !selectedDetail) setForm(toForm(refreshed));
      }
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadPartners() {
    try {
      const data = await getAdminPartners({ status: 'ALL' });
      setPartnerOptions(Array.isArray(data?.items) ? data.items : []);
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => load(filters), 250);
    return () => clearTimeout(timer);
  }, [filters.q, filters.role, filters.accountStatus]);

  useEffect(() => {
    loadPartners();
  }, []);

  function syncDetailedUser(updated) {
    setSelectedDetail(updated);
    setForm(toForm(updated));
    setItems((current) => current.map((item) =>
      String(item.id) === String(updated.id)
        ? {
            ...item,
            ...updated,
            partnerMembershipCount: updated.partnerMembershipCount
          }
        : item
    ));
  }

  async function openUser(item) {
    setSelectedId(item.id);
    setSelectedDetail(item);
    setForm(toForm(item));
    setWalletAmount('');
    setWalletReason('');
    setPartnerAssign({ partnerId: '', role: 'STAFF' });
    setDetailLoading(true);

    try {
      const detailed = await getAdminUser(item.id);
      syncDetailedUser(detailed);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setDetailLoading(false);
    }
  }

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (!selected) return;

    setSaving(true);
    try {
      const updated = await updateAdminUser(selected.id, {
        name: form.name.trim(),
        email: form.email.trim(),
        bio: form.bio.trim() || null,
        role: form.role,
        accountStatus: form.accountStatus
      });
      syncDetailedUser(updated);
      showToast('Đã cập nhật tài khoản.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function adjustWallet(event) {
    event.preventDefault();
    if (!selected) return;

    const amount = Number(walletAmount);
    if (!Number.isInteger(amount) || amount === 0) {
      showToast('Nhập số điểm cộng hoặc trừ khác 0.', 'error');
      return;
    }
    if (walletReason.trim().length < 3) {
      showToast('Nhập lý do điều chỉnh ví điểm.', 'error');
      return;
    }

    setSaving(true);
    try {
      const updated = await adjustAdminUserWallet(selected.id, {
        amount,
        reason: walletReason.trim()
      });
      syncDetailedUser(updated);
      setWalletAmount('');
      setWalletReason('');
      showToast('Đã điều chỉnh ví điểm.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function assignPartnerAccess(event) {
    event.preventDefault();
    if (!selected) return;
    if (!partnerAssign.partnerId) {
      showToast('Chọn quán/đối tác cần cấp quyền.', 'error');
      return;
    }

    setPartnerSaving(true);
    try {
      const updated = await assignAdminUserPartnerAccess(selected.id, {
        partnerId: Number(partnerAssign.partnerId),
        role: partnerAssign.role
      });
      syncDetailedUser(updated);
      setPartnerAssign({ partnerId: '', role: 'STAFF' });
      showToast(
        partnerAssign.role === 'OWNER'
          ? 'Đã cấp quyền OWNER cho đối tác.'
          : 'Đã cấp quyền STAFF cho đối tác.',
        'success'
      );
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setPartnerSaving(false);
    }
  }

  async function changePartnerAccess(membership, patch) {
    if (!selected || partnerUpdatingId) return;
    setPartnerUpdatingId(membership.id);

    try {
      const updated = await updateAdminUserPartnerAccess(
        selected.id,
        membership.id,
        patch
      );
      syncDetailedUser(updated);
      showToast('Đã cập nhật quyền đối tác.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setPartnerUpdatingId(null);
    }
  }

  const activePartnerIds = new Set(
    (selected?.partnerMemberships || [])
      .filter((item) => item.status === 'ACTIVE')
      .map((item) => String(item.partnerId))
  );

  return (
    <main className="admin-page admin-users-page page-container">
      <section className="section-heading admin-users-heading">
        <div>
          <span className="eyebrow">COMMUNITY MANAGEMENT</span>
          <h2>Quản lý người dùng</h2>
          <p>Sửa hồ sơ, phân quyền hệ thống, quyền Partner, khóa tài khoản và điều chỉnh ví điểm Explorer.</p>
        </div>
        <div className="admin-users-total"><Users size={18} /><b>{items.length}</b><span>tài khoản</span></div>
      </section>

      <section className="admin-users-filters">
        <label className="admin-users-search">
          <Search size={17} />
          <input
            value={filters.q}
            onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
            placeholder="Tìm tên hoặc email..."
          />
        </label>

        <select
          value={filters.role}
          onChange={(event) => setFilters((current) => ({ ...current, role: event.target.value }))}
        >
          <option value="ALL">Tất cả vai trò hệ thống</option>
          <option value="USER">USER</option>
          <option value="CONTRIBUTOR">CONTRIBUTOR</option>
          <option value="MODERATOR">MODERATOR</option>
          <option value="ADMIN">ADMIN</option>
        </select>

        <select
          value={filters.accountStatus}
          onChange={(event) => setFilters((current) => ({ ...current, accountStatus: event.target.value }))}
        >
          <option value="ALL">Tất cả trạng thái</option>
          <option value="ACTIVE">Đang hoạt động</option>
          <option value="SUSPENDED">Đã khóa</option>
        </select>
      </section>

      <section className={selected ? 'admin-users-layout editing' : 'admin-users-layout'}>
        <div className="admin-users-list-panel">
          {loading && <div className="loading-card">Đang tải người dùng...</div>}

          {!loading && !items.length && (
            <div className="empty-state"><Users size={23} /><b>Không tìm thấy tài khoản</b></div>
          )}

          <div className="admin-users-list">
            {items.map((item) => (
              <button
                type="button"
                className={String(selectedId) === String(item.id) ? 'admin-user-row active' : 'admin-user-row'}
                onClick={() => openUser(item)}
                key={item.id}
              >
                <span className="admin-user-avatar">
                  {item.avatarUrl ? <img src={item.avatarUrl} alt="" /> : item.name?.slice(0, 1)?.toUpperCase()}
                </span>
                <span className="admin-user-row-main">
                  <span><b>{item.name}</b>{String(item.id) === String(currentUser?.id) && <em>Bạn</em>}</span>
                  <small>{item.email}</small>
                  <span className="admin-user-meta">
                    <i className={'role ' + String(item.role).toLowerCase()}>{item.role}</i>
                    {Number(item.partnerMembershipCount || 0) > 0 && (
                      <i className="role partner">PARTNER {item.partnerMembershipCount}</i>
                    )}
                    <i className={'status ' + String(item.accountStatus).toLowerCase()}>{item.accountStatus}</i>
                  </span>
                </span>
                <span className="admin-user-points"><Coins size={13} />{item.pointsBalance}</span>
              </button>
            ))}
          </div>
        </div>

        <aside className="admin-user-editor">
          {!selected ? (
            <div className="admin-user-editor-empty">
              <UserCog size={32} />
              <b>Chọn một người dùng</b>
              <span>Xem thông tin và chỉnh sửa tài khoản ở đây.</span>
            </div>
          ) : (
            <>
              <button className="admin-user-mobile-back" type="button" onClick={() => {
                setSelectedId(null);
                setSelectedDetail(null);
              }}>← Danh sách</button>

              <div className="admin-user-overview">
                <span className="admin-user-avatar large">
                  {selected.avatarUrl ? <img src={selected.avatarUrl} alt="" /> : selected.name?.slice(0, 1)?.toUpperCase()}
                </span>
                <div>
                  <small>USER #{selected.id}</small>
                  <h2>{selected.name}</h2>
                  <span>Tham gia {new Date(selected.createdAt).toLocaleDateString('vi-VN')}</span>
                </div>
              </div>

              <div className="admin-user-stat-grid">
                <div><b>{selected.points}</b><span>Điểm thành tích</span></div>
                <div><b>{selected.pointsBalance}</b><span>Ví điểm</span></div>
                <div><b>{selected.contributionsCount}</b><span>Đóng góp</span></div>
                <div><b>{selected.trustScore}</b><span>Trust score</span></div>
              </div>

              <form className="admin-user-form" onSubmit={saveProfile}>
                <h3><Shield size={17} /> Hồ sơ & quyền hệ thống</h3>
                <p className="admin-user-form-note">
                  Vai trò này điều khiển quyền trên toàn Hola Maps. Quyền quán/đối tác được quản lý riêng ở mục bên dưới.
                </p>

                <label>
                  Tên hiển thị
                  <input value={form.name} onChange={(event) => updateField('name', event.target.value)} />
                </label>

                <label>
                  Email
                  <input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} />
                </label>

                <label>
                  Giới thiệu
                  <textarea rows="3" value={form.bio} onChange={(event) => updateField('bio', event.target.value)} placeholder="Bio của người dùng..." />
                </label>

                <div className="admin-user-form-row">
                  <label>
                    Vai trò hệ thống
                    <select value={form.role} onChange={(event) => updateField('role', event.target.value)}>
                      <option value="USER">USER</option>
                      <option value="CONTRIBUTOR">CONTRIBUTOR</option>
                      <option value="MODERATOR">MODERATOR</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </label>

                  <label>
                    Trạng thái
                    <select value={form.accountStatus} onChange={(event) => updateField('accountStatus', event.target.value)}>
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="SUSPENDED">SUSPENDED</option>
                    </select>
                  </label>
                </div>

                <button className="primary-action" type="submit" disabled={saving}>
                  <Save size={16} /> {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </form>

              <section className="admin-user-partner-access">
                <div className="admin-user-partner-head">
                  <span><Building2 size={18} /></span>
                  <div>
                    <h3>Quyền Partner Portal</h3>
                    <p>
                      Cấp OWNER hoặc STAFF theo từng quán. Người dùng vẫn giữ role hệ thống hiện tại.
                    </p>
                  </div>
                  <b>{selected.partnerMembershipCount || 0}</b>
                </div>

                {detailLoading ? (
                  <div className="loading-card">Đang tải quyền đối tác...</div>
                ) : (
                  <>
                    <form className="admin-partner-access-assign" onSubmit={assignPartnerAccess}>
                      <label>
                        Quán / đối tác
                        <select
                          value={partnerAssign.partnerId}
                          onChange={(event) => setPartnerAssign((current) => ({
                            ...current,
                            partnerId: event.target.value
                          }))}
                        >
                          <option value="">Chọn đối tác...</option>
                          {partnerOptions.map((partner) => (
                            <option
                              key={partner.id}
                              value={partner.id}
                              disabled={activePartnerIds.has(String(partner.id))}
                            >
                              {partner.partnerName || partner.placeName} · {partner.status}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        Quyền tại quán
                        <select
                          value={partnerAssign.role}
                          onChange={(event) => setPartnerAssign((current) => ({
                            ...current,
                            role: event.target.value
                          }))}
                        >
                          <option value="STAFF">STAFF · Quét voucher</option>
                          <option value="OWNER">OWNER · Quản lý quán</option>
                        </select>
                      </label>

                      <button className="primary-action" type="submit" disabled={partnerSaving}>
                        <UserPlus size={15} />
                        {partnerSaving ? 'Đang cấp...' : 'Cấp quyền Partner'}
                      </button>
                    </form>

                    <div className="admin-user-partner-list">
                      {!selected.partnerMemberships?.length ? (
                        <div className="admin-user-partner-empty">
                          <Store size={24} />
                          <b>Chưa có quyền đối tác</b>
                          <span>Chọn một quán phía trên để cấp OWNER hoặc STAFF.</span>
                        </div>
                      ) : (
                        selected.partnerMemberships.map((membership) => (
                          <article
                            className={membership.status === 'ACTIVE'
                              ? 'admin-user-partner-row active'
                              : 'admin-user-partner-row inactive'}
                            key={membership.id}
                          >
                            <span className="admin-user-partner-icon"><Store size={18} /></span>
                            <div className="admin-user-partner-copy">
                              <small>{membership.partnerStatus} · {membership.status}</small>
                              <b>{membership.partnerName || membership.placeName}</b>
                              <span>{membership.placeAddress || 'Hòa Lạc'}</span>
                            </div>

                            <label>
                              Role
                              <select
                                value={membership.role}
                                disabled={partnerUpdatingId === membership.id}
                                onChange={(event) => changePartnerAccess(membership, {
                                  role: event.target.value
                                })}
                              >
                                <option value="STAFF">STAFF</option>
                                <option value="OWNER">OWNER</option>
                              </select>
                            </label>

                            <label>
                              Trạng thái
                              <select
                                value={membership.status}
                                disabled={partnerUpdatingId === membership.id}
                                onChange={(event) => changePartnerAccess(membership, {
                                  status: event.target.value
                                })}
                              >
                                <option value="ACTIVE">ACTIVE</option>
                                <option value="INACTIVE">INACTIVE</option>
                              </select>
                            </label>

                            {membership.status === 'ACTIVE' && (
                              <a href="/partner" target="_blank" rel="noreferrer" title="Mở Partner Portal">
                                <ExternalLink size={14} />
                              </a>
                            )}
                          </article>
                        ))
                      )}
                    </div>
                  </>
                )}
              </section>

              <form className="admin-wallet-form" onSubmit={adjustWallet}>
                <h3><Coins size={17} /> Điều chỉnh ví điểm</h3>
                <p>Chỉ thay đổi số điểm có thể dùng để đổi quà, không thay đổi điểm thành tích trên leaderboard.</p>

                <div className="admin-wallet-row">
                  <input
                    type="number"
                    value={walletAmount}
                    onChange={(event) => setWalletAmount(event.target.value)}
                    placeholder="+100 hoặc -50"
                  />
                  <input
                    value={walletReason}
                    onChange={(event) => setWalletReason(event.target.value)}
                    placeholder="Lý do điều chỉnh..."
                  />
                </div>

                <button className="secondary-action" type="submit" disabled={saving}>
                  <Coins size={15} /> Cập nhật ví
                </button>
              </form>

              {selected.accountStatus === 'SUSPENDED' && (
                <div className="admin-user-warning"><Ban size={17} /> Tài khoản này đang bị khóa và không thể đăng nhập/sử dụng API có xác thực.</div>
              )}
            </>
          )}
        </aside>
      </section>
    </main>
  );
}
