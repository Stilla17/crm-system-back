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
    return this.companyModel.find().sort({ createdAt: -1 }).exec();
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

  async deleteCompany(id: string) {
    const company = await this.companyModel.findOneAndDelete({ id }).exec();

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return {
      message: "Company o'chirildi",
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

    const slug = generateSlug(dto.name);
    const existingRole = await this.roleModel
      .findOne({
        companyId,
        slug,
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
}
