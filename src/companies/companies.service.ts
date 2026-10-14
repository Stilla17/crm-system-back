import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Company, CompanyDocument } from './schemas/company.schema.js';
import { Model } from 'mongoose';
import { CreateCompanyDto } from './dto/create-company.dto.js';
import { UpdateCompanyDto } from './dto/update-company.dto.js';
import { isMongoDuplicateKeyError } from '../common/utils/mongo-error.util.js';
import { generateSlug } from '../common/utils/generate-slug.js';
import { User, UserStatus } from '../users/schemas/user.schema.js';
import { Role } from '../roles/schemas/role.schema.js';
import { CreateCompanyAdminDto } from './dto/create-company-admin.dto.js';
import { RoleScope } from '../roles/enum/role-scope.enum.js';
import * as bcrypt from 'bcrypt';
import { COMPANY_ADMIN_PERMISSIONS } from '../auth/permissions/role-permissions.js';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,

    @InjectModel(Role.name)
    private readonly roleModel: Model<Role>,

    @InjectModel(User.name)
    private readonly userModel: Model<User>,
  ) {}

  async getAllCompanies() {
    const companies = await this.companyModel
      .find()
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    if (companies.length === 0) {
      return [];
    }

    const companyIds = companies.map((company) => company.id);

    // Har bir kompaniyaning Company Admin rolini topamiz
    const adminRoles = await this.roleModel
      .find({
        companyId: { $in: companyIds },
        slug: 'company-admin',
      })
      .select({
        id: 1,
        companyId: 1,
      })
      .lean()
      .exec();

    const adminRoleIds = adminRoles.map((role) => role.id);

    // Shu rollarga tegishli userlarni topamiz
    const admins = await this.userModel
      .find({
        roleId: { $in: adminRoleIds },
      })
      .select({
        id: 1,
        companyId: 1,
        roleId: 1,
        name: 1,
        middleName: 1,
        phone: 1,
        login: 1,
        status: 1,
      })
      .lean()
      .exec();

    const adminRoleByCompanyId = new Map(
      adminRoles.map((role) => [role.companyId, role.id]),
    );

    const adminByRoleId = new Map(admins.map((admin) => [admin.roleId, admin]));

    return companies.map((company) => {
      const adminRoleId = adminRoleByCompanyId.get(company.id);
      const admin = adminRoleId ? adminByRoleId.get(adminRoleId) : undefined;

      return {
        ...company,
        hasAdmin: Boolean(admin),
        admin: admin
          ? {
              id: admin.id,
              name: admin.name,
              middleName: admin.middleName,
              phone: admin.phone,
              login: admin.login,
              status: admin.status,
            }
          : null,
      };
    });
  }

  async getCompanyById(id: string) {
    const company = await this.companyModel.findOne({ id }).exec();

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return company;
  }

  async createCompany(dto: CreateCompanyDto): Promise<CompanyDocument> {
    const slug = generateSlug(dto.companyName);

    if (!slug) {
      throw new BadRequestException('Company nomidan slug yaratib bo‘lmadi');
    }

    try {
      return await this.companyModel.create({
        ...dto,
        slug,
      });
    } catch (error: unknown) {
      if (isMongoDuplicateKeyError(error)) {
        throw new ConflictException('Bunday slug bilan role mavjud');
      }

      throw error;
    }
  }

  async updateCompany(id: string, dto: UpdateCompanyDto) {
    try {
      const company = await this.companyModel
        .findOneAndUpdate(
          { id },
          {
            $set: {
              ...dto,
            },
          },
          {
            new: true,
            runValidators: true,
          },
        )
        .exec();

      if (!company) {
        throw new NotFoundException('Company not found');
      }

      return company;
    } catch (error: unknown) {
      if (isMongoDuplicateKeyError(error)) {
        throw new ConflictException('Bunday slug bilan role mavjud');
      }

      throw error;
    }
  }

  async archiveCompany(id: string) {
    const company = await this.companyModel
      .findOneAndUpdate(
        { id },
        {
          $set: {
            isActive: false,
          },
        },
        {
          new: true,
          runValidators: true,
        },
      )
      .exec();

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return {
      message: 'Company arxivlandi',
      company,
    };
  }

  async restoreCompany(id: string) {
    const company = await this.companyModel
      .findOneAndUpdate(
        { id },
        {
          $set: {
            isActive: true,
          },
        },
        {
          new: true,
          runValidators: true,
        },
      )
      .exec();

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return {
      message: 'Company arxivdan chiqarildi',
      company,
    };
  }

  async deleteCompany(id: string) {
    const company = await this.companyModel.findOneAndDelete({ id }).exec();

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return {
      message: "Company butunlay o'chirildi",
      company,
    };
  }

  async createCompanyAdmin(companyId: string, dto: CreateCompanyAdminDto) {
    const company = await this.companyModel.findOne({ id: companyId }).exec();

    if (!company) {
      throw new NotFoundException('Company topilmadi');
    }

    if (!company.isActive) {
      throw new BadRequestException(
        'Nofaol company uchun admin yaratib bo‘lmaydi',
      );
    }

    const login = dto.login.toLowerCase().trim();

    const existingUser = await this.userModel.findOne({ login }).exec();

    if (existingUser) {
      throw new ConflictException('Bunday login bazada mavjud');
    }

    const existingRole = await this.roleModel
      .findOne({
        companyId,
        slug: 'company-admin',
      })
      .exec();

    if (existingRole) {
      throw new ConflictException(
        'Bu company uchun admin allaqachon yaratilgan',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const role = await this.roleModel.create({
      companyId,
      roleName: 'Company Admin',
      slug: 'company-admin',
      scope: RoleScope.COMPANY,
      permissions: [...COMPANY_ADMIN_PERMISSIONS],
      isActive: true,
    });

    try {
      const user = await this.userModel.create({
        companyId,
        roleId: role.id,
        name: dto.name,
        phone: dto.phone,
        middleName: dto.middleName,
        login,
        password: passwordHash,
        status: UserStatus.ACTIVE,
      });

      return {
        message: 'Company admin muvaffaqiyatli yaratildi',
        admin: {
          id: user.id,
          companyId: user.companyId,
          roleId: user.roleId,
          name: user.name,
          login: user.login,
          status: user.status,
        },
        role: {
          id: role.id,
          roleName: role.roleName,
          permissions: role.permissions,
        },
      };
    } catch (error) {
      // User yaratilmasa, yaratilgan role’ni tozalaymiz.
      await this.roleModel
        .findOneAndDelete({
          id: role.id,
          companyId,
        })
        .exec();

      throw error;
    }
  }

  async replaceCompanyAdmin(companyId: string, dto: CreateCompanyAdminDto) {
    const company = await this.companyModel.findOne({ id: companyId }).exec();

    if (!company) {
      throw new NotFoundException('Company topilmadi');
    }

    if (!company.isActive) {
      throw new BadRequestException(
        'Nofaol kompaniyaga rahbar tayinlab bo‘lmaydi',
      );
    }

    const adminRole = await this.roleModel
      .findOne({
        companyId,
        slug: 'company-admin',
      })
      .exec();

    if (!adminRole) {
      throw new NotFoundException('Company Admin roli topilmadi');
    }

    const currentAdmin = await this.userModel
      .findOne({
        companyId,
        roleId: adminRole.id,
        status: UserStatus.ACTIVE,
      })
      .exec();

    if (!currentAdmin) {
      throw new NotFoundException('Amaldagi Company Admin topilmadi');
    }

    const login = dto.login.toLowerCase().trim();

    const existingUser = await this.userModel.findOne({ login }).exec();

    if (existingUser) {
      throw new ConflictException('Bunday login bazada mavjud');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const newAdmin = await this.userModel.create({
      companyId,
      roleId: adminRole.id,
      name: dto.name,
      middleName: dto.middleName,
      phone: dto.phone,
      login,
      password: passwordHash,
      status: UserStatus.ACTIVE,
    });

    try {
      await this.userModel
        .findOneAndUpdate(
          {
            id: currentAdmin.id,
            companyId,
          },
          {
            $set: {
              status: UserStatus.INACTIVE,
              refreshToken: null,
            },
          },
        )
        .exec();
    } catch (error) {
      // Eski adminni o‘chirishda xato bo‘lsa,
      // yangi yaratilgan adminni tozalaymiz.
      await this.userModel
        .findOneAndDelete({
          id: newAdmin.id,
          companyId,
        })
        .exec();

      throw error;
    }

    return {
      message: 'Company admin muvaffaqiyatli almashtirildi',
      previousAdmin: {
        id: currentAdmin.id,
        name: currentAdmin.name,
        status: UserStatus.INACTIVE,
      },
      admin: {
        id: newAdmin.id,
        companyId: newAdmin.companyId,
        roleId: newAdmin.roleId,
        name: newAdmin.name,
        middleName: newAdmin.middleName,
        phone: newAdmin.phone,
        login: newAdmin.login,
        status: newAdmin.status,
      },
    };
  }
}
