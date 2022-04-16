import { PickType } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";

export class OtpVerifyDto {
	@IsNotEmpty()
	otpCode!: string;

	@IsNotEmpty()
	email!: string;
}

export class SendOtpDto extends PickType(OtpVerifyDto, ["email"] as const) {}