import { PageOptionsDto } from "@common/classes/pagination";
import { AppResource, AppRoles } from "@common/constants/app.roles";
import { Auth } from "@common/decorators/auth.decorator";
import { LoggedInUser } from "@common/decorators/user.decorator";
import { ImageMulterOption } from "@common/misc/misc";
import { ParseFilePipe } from "@common/pipes/parse-file.pipe";
import { User as UserEntity } from "@entities";
import {
	Body,
	CacheInterceptor,
	Controller,
	Delete,
	Get,
	Param,
	ParseUUIDPipe,
	Post,
	Put,
	Query,
	UploadedFile,
	UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { omit } from "@rubiin/js-utils";
import { InjectRolesBuilder, RolesBuilder } from "nest-access-control";
import { CreateUserDto, EditUserDto, UserRegistrationDto } from "./dtos";
import { UserService } from "./user.service";

@ApiTags("Users routes")
@UseInterceptors(CacheInterceptor)
@Controller("user")
export class UserController {
	constructor(
		private readonly userService: UserService,
		@InjectRolesBuilder()
		private readonly rolesBuilder: RolesBuilder,
	) {}

	@ApiOperation({ summary: "Users list" })
	@Get()
	async getMany(@Query() pageOptionsDto: PageOptionsDto) {
		const data = await this.userService.getMany(pageOptionsDto);

		return { data };
	}

	@ApiOperation({ summary: "public registration" })
	@UseInterceptors(FileInterceptor("avatar", ImageMulterOption))
	@Post("register")
	async publicRegistration(
		@Body() dto: UserRegistrationDto,
		@UploadedFile(ParseFilePipe) image: Express.Multer.File,
	) {
		return this.userService.createOne({
			...dto,
			roles: [AppRoles.AUTHOR],
			image,
		});
	}

	@ApiOperation({ summary: "User fetch" })
	@Get(":idx")
	async getOne(@Param("idx", ParseUUIDPipe) index: string) {
		return this.userService.getOne(index);
	}

	@ApiOperation({ summary: "Admin create user" })
	@Auth({
		possession: "any",
		action: "create",
		resource: AppResource.USER,
	})
	@UseInterceptors(FileInterceptor("avatar", ImageMulterOption))
	@Post()
	async createOne(
		@Body() dto: CreateUserDto,
		@UploadedFile(ParseFilePipe) image: Express.Multer.File,
	) {
		return this.userService.createOne({ ...dto, image });
	}

	@ApiOperation({ summary: "Edit user" })
	@Auth({
		possession: "own",
		action: "update",
		resource: AppResource.USER,
	})
	@Put(":idx")
	async editOne(
		@Param("idx", ParseUUIDPipe) index: string,
		@Body() dto: EditUserDto,
		@LoggedInUser() user: UserEntity,
	) {
		return this.rolesBuilder.can(user.roles).updateAny(AppResource.USER)
			.granted
			? this.userService.editOne(index, dto)
			: this.userService.editOne(index, omit(dto, ["roles"]), user);
	}

	@ApiOperation({ summary: "User delete" })
	@Auth({
		action: "delete",
		possession: "own",
		resource: AppResource.USER,
	})
	@Delete(":idx")
	async deleteOne(
		@Param("idx", ParseUUIDPipe) index: string,
		@LoggedInUser() user: UserEntity,
	) {
		return this.rolesBuilder.can(user.roles).updateAny(AppResource.USER)
			.granted
			? this.userService.deleteOne(index)
			: this.userService.deleteOne(index, user);
	}
}
