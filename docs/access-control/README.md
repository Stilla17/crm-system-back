# Role, User va Auth tizimi

Ushbu hujjat CRM backenddagi autentifikatsiya va ruxsatlarni boshqarish tizimini tushuntiradi.

## 1. Asosiy tushunchalar

Tizim quyidagi bog‘lanish asosida ishlaydi:

```text
Company
  ├── Roles
  │     └── Permissions
  └── Users
        └── roleId → Role
```

- Har bir `User` bitta kompaniyaga tegishli.
- Har bir `Role` bitta kompaniyaga tegishli.
- User o‘z kompaniyasidagi bitta role bilan bog‘lanadi.
- Permissionlar user ichida emas, role ichida saqlanadi.
- JWT tekshirilganda user va role bazadan qayta olinadi.
- Endpointga kirish role ichidagi permissionlar orqali tekshiriladi.

## 2. Ma’lumotlar tuzilishi

### Role

```ts
interface Role {
  id: string;
  companyId: string;
  roleName: string;
  slug: string;
  permissions: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

Misol:

```json
{
  "id": "role-uuid",
  "companyId": "company-uuid",
  "roleName": "Manager",
  "slug": "manager",
  "permissions": ["users.read", "customers.read", "customers.create"],
  "isActive": true
}
```

`companyId + slug` juftligi unique hisoblanadi. Shu sababli bitta kompaniyada ikkita `manager` role bo‘lmaydi, lekin boshqa kompaniya o‘zining `manager` role’ini yarata oladi.

### User

```ts
interface User {
  id: string;
  companyId: string;
  roleId: string;
  name: string;
  login: string;
  password: string;
  status: 'active' | 'inactive';
  refreshToken?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

User ichida `roleName` va `permissions` saqlanmaydi. Ular `roleId` orqali role’dan olinadi.

## 3. Nega companyId frontenddan olinmaydi?

Himoyalangan endpointlarda `companyId` request body yoki URL’dan emas, login qilgan userdan olinadi:

```ts
req.user.companyId;
```

Bu foydalanuvchining boshqa kompaniya ID’sini yuborib, uning ma’lumotlariga kirishining oldini oladi.

Controller misoli:

```ts
createRole(
  @Body() dto: CreateRoleDto,
  @Req() req: AuthenticatedRequest,
) {
  return this.rolesService.createRole(
    dto,
    req.user.companyId,
  );
}
```

Service querylarida ham `companyId` majburiy ishlatiladi:

```ts
this.roleModel.findOne({
  id: roleId,
  companyId,
});
```

## 4. AuthenticatedRequest

JWT muvaffaqiyatli tekshirilgandan keyin `request.user` quyidagi ko‘rinishda bo‘ladi:

```ts
interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    companyId: string;
    roleId: string;
    permissions: string[];
  };
}
```

Umumiy type manzili:

```text
src/common/types/authenticated-request.type.ts
```

## 5. Login oqimi

```text
POST /api/v1/auth/login
        ↓
Login bo‘yicha user topiladi
        ↓
Parol bcrypt bilan tekshiriladi
        ↓
Access va refresh token yaratiladi
        ↓
Tokenlar HTTP cookie orqali qaytariladi
```

JWT payload minimal saqlanadi:

```ts
{
  sub: user.id,
  login: user.login,
}
```

Permissionlar token ichida saqlanmaydi. Har bir himoyalangan requestda JWT strategy:

1. `payload.sub` orqali userni topadi.
2. `user.roleId` va `user.companyId` orqali role’ni topadi.
3. User faol ekanini tekshiradi.
4. Role faol ekanini tekshiradi.
5. Role permissionlarini `request.user`ga qo‘shadi.

Natija:

```ts
{
  id: user.id,
  login: user.login,
  companyId: user.companyId,
  roleId: user.roleId,
  roleName: role.roleName,
  permissions: role.permissions,
}
```

Bu usulda role permissionlari o‘zgarsa, eski access token ishlatilayotgan bo‘lsa ham yangi permissionlar darhol qo‘llanadi.

## 6. Guardlar qanday ishlaydi?

Controller ikki guard bilan himoyalanadi:

```ts
@UseGuards(JwtAuthGuard, PermissionsGuard)
```

### JwtAuthGuard

- Access token mavjudligini tekshiradi.
- Token imzosini tekshiradi.
- Userni bazadan topadi.
- User statusini tekshiradi.
- Role’ni bazadan topadi.
- Role statusini tekshiradi.
- `request.user`ni tayyorlaydi.

### PermissionsGuard

Endpoint talab qilgan permissionni tekshiradi:

```ts
@RequirePermissions('roles.create')
```

User role’ida permission bo‘lmasa:

```http
403 Forbidden
```

Token noto‘g‘ri, user inactive yoki role inactive bo‘lsa:

```http
401 Unauthorized
```

## 7. Role endpointlari

Barcha endpointlar JWT va permission bilan himoyalangan.

| Method  | Endpoint            | Permission     | Vazifasi                   |
| ------- | ------------------- | -------------- | -------------------------- |
| `POST`  | `/api/v1/roles`     | `roles.create` | Role yaratadi              |
| `GET`   | `/api/v1/roles`     | `roles.read`   | Kompaniya rolelarini oladi |
| `GET`   | `/api/v1/roles/:id` | `roles.read`   | Bitta role’ni oladi        |
| `PATCH` | `/api/v1/roles/:id` | `roles.update` | Role’ni yangilaydi         |

Role yaratish body misoli:

```json
{
  "roleName": "Manager",
  "slug": "manager",
  "permissions": ["users.read", "customers.read", "customers.create"]
}
```

`companyId` body’da yuborilmaydi. U JWT orqali olinadi.

Role’ni nofaol qilish:

```http
PATCH /api/v1/roles/:id
```

```json
{
  "isActive": false
}
```

## 8. Inactive role qoidasi

Loyihada inactive role’ga user biriktirishga ruxsat berilgan.

Bu quyidagicha ishlaydi:

```text
Inactive role + user yaratish → ruxsat beriladi
Inactive role + API request    → 401 qaytadi
Role active qilinadi           → user ishlay boshlaydi
```

Shuning uchun user yaratishda role mavjudligi va kompaniyaga tegishliligi tekshiriladi, ammo `isActive` tekshirilmaydi.

## 9. User endpointlari

| Method   | Endpoint            | Permission     | Vazifasi                         |
| -------- | ------------------- | -------------- | -------------------------------- |
| `POST`   | `/api/v1/users`     | `users.create` | User yaratadi                    |
| `GET`    | `/api/v1/users`     | `users.read`   | Kompaniya userlarini oladi       |
| `GET`    | `/api/v1/users/:id` | `users.read`   | Kompaniyadagi bitta userni oladi |
| `PATCH`  | `/api/v1/users/:id` | `users.update` | Userni yangilaydi                |
| `DELETE` | `/api/v1/users/:id` | `users.delete` | Userni o‘chiradi                 |

User yaratish body misoli:

```json
{
  "name": "Ali Valiyev",
  "roleId": "role-uuid",
  "login": "ali",
  "password": "strong-password"
}
```

User yaratilganda:

1. Role shu kompaniyaga tegishli ekanligi tekshiriladi.
2. Login takrorlanmaganligi tekshiriladi.
3. Parol bcrypt bilan hash qilinadi.
4. `companyId` login qilgan admin userdan olinadi.
5. User bazaga saqlanadi.

User role’i yangilanganda yangi role ham shu kompaniyaga tegishli ekanligi tekshiriladi.

## 10. Company isolation qoidasi

Oddiy controller querylari doim company bilan cheklanishi kerak:

```ts
find({ companyId });
```

```ts
findOne({ id, companyId });
```

```ts
findOneAndUpdate({ id, companyId }, update);
```

```ts
findOneAndDelete({ id, companyId });
```

Faqat JWT va refresh token kabi ichki, imzolangan identifikator bilan ishlaydigan auth metodlari userni global `id` orqali topishi mumkin.

## 11. Permission nomlash qoidasi

Permission formati:

```text
resource.action
```

Misollar:

```text
roles.read
roles.create
roles.update

users.read
users.create
users.update
users.delete

companies.read
companies.create
companies.update
companies.delete
```

Katta loyihada permission stringlarini enum yoki constant orqali boshqarish tavsiya qilinadi:

```ts
export enum Permission {
  ROLES_READ = 'roles.read',
  ROLES_CREATE = 'roles.create',
  ROLES_UPDATE = 'roles.update',
  USERS_READ = 'users.read',
  USERS_CREATE = 'users.create',
  USERS_UPDATE = 'users.update',
  USERS_DELETE = 'users.delete',
}
```

## 12. HTTP statuslar

| Status | Ma’nosi                         |
| ------ | ------------------------------- |
| `200`  | So‘rov muvaffaqiyatli           |
| `201`  | Yangi ma’lumot yaratildi        |
| `400`  | DTO yoki payload noto‘g‘ri      |
| `401`  | Token, user yoki role faol emas |
| `403`  | Kerakli permission yo‘q         |
| `404`  | User yoki role topilmadi        |
| `409`  | Login yoki slug takrorlangan    |

## 13. Hozirgi test holati

Tekshirish komandasi:

```bash
npm test
```

Hozirgi natija:

```text
Test Files: 17 passed
Tests:      17 passed
```

Build tekshiruvi:

```bash
npm run build
```

Hozirgi build muvaffaqiyatli yakunlanadi.

Mavjud unit testlar asosan controller va service dependencylari to‘g‘ri ulanganini tekshiradi. Quyidagi behavior testlarni keyinchalik qo‘shish kerak:

- boshqa kompaniyadagi role’ni userga biriktirib bo‘lmasligi;
- boshqa kompaniyadagi userni o‘qib yoki yangilab bo‘lmasligi;
- duplicate role slug `409` qaytarishi;
- duplicate login `409` qaytarishi;
- inactive user `401` qaytarishi;
- inactive role `401` qaytarishi;
- permissionsiz request `403` qaytarishi;
- role permissionlari o‘zgarganda yangi permission darhol ishlashi.

## 14. Qolgan tavsiya etilgan ishlar

Quyidagilar buildni to‘xtatmaydi, lekin production uchun muhim:

1. Login vaqtida user va role faolligini tekshirish.
2. Refresh vaqtida user va role faolligini tekshirish.
3. User yaratishda MongoDB duplicate-key xatosini `409`ga aylantirish.
4. DTO stringlarini trim qilish va faqat bo‘sh joy yuborilishini rad etish.
5. Permissionlarni enum yoki markaziy constantga ko‘chirish.
6. Eski user ma’lumotlari uchun `companyId` va `roleId` migration yozish.
7. Birinchi company, owner role va owner userni yaratadigan bootstrap jarayonini belgilash.

## 15. Ishga tushirishdan oldingi checklist

- [ ] Bazadagi barcha userlarda `companyId` mavjud.
- [ ] Bazadagi barcha userlarda `roleId` mavjud.
- [ ] Har bir role’da `companyId` mavjud.
- [ ] Har bir kompaniyada kamida bitta boshqaruvchi role mavjud.
- [ ] Boshqaruvchi role’da `roles.*` va `users.*` uchun kerakli permissionlar mavjud.
- [ ] Compound index `{ companyId, slug }` MongoDB’da yaratilgan.
- [ ] `.env` ichida access va refresh token secretlari mavjud.
- [ ] `npm run build` muvaffaqiyatli.
- [ ] `npm test` muvaffaqiyatli.
