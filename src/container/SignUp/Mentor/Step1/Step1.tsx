'use client'
import { observer } from 'mobx-react-lite'
import { useRouter } from 'next/navigation'
import genderList from '~/constant/data/gender.json'
import countryList from '~/constant/data/countries.json'
import FormSelect from '../../components/FormSelect/FormSelect'
import { Form } from '../../components/Form'
import Joi from 'joi/lib'
import FormButton from '../../components/FormButton/FormButton'
import rootStore from '~/store'
import { runInAction } from 'mobx'
import FormPhoneInput from '../../components/FormPhoneInput/FormPhoneInput'
const Step1 = () => {
    const router = useRouter()
    const schema = Joi.object({
        phoneNumber: Joi.string().max(17).required().messages({
            'string.empty': 'Phone number is required',
            'string.max': "This doesn't look like a phone number",
        }),
        gender: Joi.string()
            .required()
            .messages({ 'any.required': 'Gender is required' }),
        country: Joi.string()
            .required()
            .messages({ 'any.required': 'Country is required' }),
    }).messages({
        'any.required': 'is a required field',
    })
    const onSubmit = ({ phoneNumber, gender, country }: mentorStep1T) => {
        runInAction(() => {
            rootStore.signUpStore.phoneNumber = phoneNumber
            rootStore.signUpStore.gender = gender
            rootStore.signUpStore.country = country
        })
        router.push('/signup/mentor/step2')
    }
    return (
        <div className="flex justify-center items-center h-full">
            <div className="flex justify-center items-center shadow-lg p-10 rounded-xl w-150">
                <div className="flex flex-col gap-10">
                    <div className="text-3xl font-bold">
                        {"Hello! What's your origin story?"}
                    </div>
                    <Form onSubmit={onSubmit} schema={schema}>
                        <FormPhoneInput
                            label="Phone number"
                            registerName={'phoneNumber'}
                        />
                        <FormSelect
                            label="Gender"
                            registerName={'gender'}
                            dataList={genderList}
                        />
                        <FormSelect
                            label="Country"
                            registerName={'country'}
                            dataList={countryList}
                        />
                        <div className="w-full flex justify-between">
                            <button
                                type="button"
                                className="font-bold"
                                onClick={() => router.back()}
                            >
                                {'< back'}
                            </button>
                            <FormButton variant={'nextButton'}>Next</FormButton>
                        </div>
                    </Form>
                </div>
            </div>
        </div>
    )
}

export default observer(Step1)
