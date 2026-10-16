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
import { ReplaceCompanyAdminDto } from './dto/replace-company-admin.dto.js';

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

  async getPublicCompanies() {
    return this.companyModel
      .find()
      .select({
        _id: 0,
        id: 1,
        companyName: 1,
        brandColor: 1,
      })
      .sort({ companyName: 1 })
      .lean()
      .exec();
  }

  async getAllCompanies() {
    const companies = await this.companyModel
      .find()
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    if (companies.length === 0) {
      return [];
    }

    const companyAdminRole = await this.roleModel
      .findOne({
        slug: 'director',
        scope: RoleScope.COMPANY,
        isActive: true,
      })
      .lean()
      .exec();

    if (!companyAdminRole) {
      return companies.map((company) => ({
        ...company,
        hasAdmin: false,
        admin: null,
      }));
    }

    const companyIds = companies.map((company) => company.id);

    const admins = await this.userModel
      .find({
        companyId: { $in: companyIds },
        roleId: companyAdminRole.id,
        status: UserStatus.ACTIVE,
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

    const adminByCompanyId = new Map(
      admins.map((admin) => [admin.companyId, admin]),
    );

    return companies.map((company) => {
      const admin = adminByCompanyId.get(company.id);

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

    const companyAdminRole = await this.roleModel
      .findOne({
        slug: 'director',
        scope: RoleScope.COMPANY,
        isActive: true,
      })
      .exec();

    if (!companyAdminRole) {
      throw new NotFoundException(
        'Global Director roli topilmadi. Seedni ishga tushiring',
      );
    }

    const existingAdmin = await this.userModel
      .findOne({ companyId, roleId: companyAdminRole.id })
      .exec();

    if (existingAdmin) {
      throw new ConflictException('Bu company uchun admin allaqachon mavjud');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.userModel.create({
      companyId,
      roleId: companyAdminRole.id,
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
        id: companyAdminRole.id,
        roleName: companyAdminRole.roleName,
        permissions: companyAdminRole.permissions,
      },
    };
  }

  async replaceCompanyAdmin(companyId: string, dto: ReplaceCompanyAdminDto) {
    const company = await this.companyModel.findOne({ id: companyId }).exec();

    if (!company) {
      throw new NotFoundException('Company topilmadi');
    }

    if (!company.isActive) {
      throw new BadRequestException(
        'Nofaol kompaniyaga rahbar tayinlab bo‘lmaydi',
      );
    }

    const selectedUser = await this.userModel.findOne({
      id: dto.newAdminId,
    });

    if (!selectedUser) {
      throw new NotFoundException('Tanlangan user topilmadi');
    }

    const adminRole = await this.roleModel.findOne({
      slug: 'director',
      scope: RoleScope.COMPANY,
      isActive: true,
    });

    if (!adminRole) {
      throw new NotFoundException(
        'Global Director roli topilmadi. Seedni ishga tushiring',
      );
    }

    const currentAdmin = await this.userModel.findOne({
      companyId,
      roleId: adminRole.id,
      status: UserStatus.ACTIVE,
    });

    if (currentAdmin?.id === selectedUser.id) {
      throw new BadRequestException(
        'Tanlangan user hozir ham kompaniya rahbari',
      );
    }

    if (currentAdmin) {
      await this.userModel.findOneAndUpdate(
        { id: currentAdmin.id, companyId },
        {
          $set: {
            status: UserStatus.INACTIVE,
            refreshToken: null,
          },
        },
      );
    }

    await this.userModel.findOneAndUpdate(
      { id: selectedUser.id },
      {
        $set: {
          companyId,
          roleId: adminRole.id,
          status: UserStatus.ACTIVE,
        },
      },
    );

    return {
      message: 'Kompaniya rahbari muvaffaqiyatli almashtirildi',
    };
  }
}
