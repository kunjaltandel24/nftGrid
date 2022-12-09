import {useEffect, useState} from "react";
import axios from "axios";
import {useAccount} from "wagmi";
import {Contract, ContractInterface} from "ethers";
import CollectionABI from "../contracts/collection_abi.json";
import {Collection_abi} from "../contracts/types";

function Block({mint, baseURI, owner, collection, setError, index, updateMint}: any) {
    const [file, setFile] = useState<File>();
    const [imageUrl, setImageUrl] = useState<string>();
    const [update, setUpdate] = useState<boolean>(false);
    const { isConnected, address, connector } = useAccount();

    const captureFile = (event: any) => {
        console.log(event);

        event.stopPropagation();
        event.preventDefault();
        const file = event.target.files[0];
        file.blobUrl = URL.createObjectURL(file);
        setFile(file);
    };

    const handleUploadFile = () => {
        console.log("index", index);
        if (!baseURI) {
            setError('Please setup the base url of collection');
            return;
        }
        if (!file) {
            return;
        }
        const filenamePart = file.name.split('.');
        let fileUploadUrl: string;
        let fileMetaUploadUrl: string;
        axios.post('https://api.ethindia.yashthakor.com/image/s3/upload', {
            path: `${address}/${collection}/${index}.${filenamePart[filenamePart.length - 1]}`,
            key: `${index}.${filenamePart[filenamePart.length - 1]}`
        }, {
            headers: {
                'X-RapidAPI-Key': 'c81dd0ce4bmshc587065bdc8c2acp1be213jsnaf77c133889b',
                'X-RapidAPI-Host': 'crypto-volatility-index.p.rapidapi.com',
                'Content-Type': 'application/json'
            },
        })
            .then((resp) => {
                fileUploadUrl = resp.data.uploadUrl;
                return axios.post('https://api.ethindia.yashthakor.com/image/s3/upload', {
                    path: `${address}/${collection}/${index}.json`,
                    key: `${index}.json`
                }, {
                    headers: {
                        'X-RapidAPI-Key': 'c81dd0ce4bmshc587065bdc8c2acp1be213jsnaf77c133889b',
                        'X-RapidAPI-Host': 'crypto-volatility-index.p.rapidapi.com',
                        'Content-Type': 'application/json'
                    },
                });
            })
            .then((resp) => {
                fileMetaUploadUrl = resp.data.uploadUrl;
            })
            .then(() => {
                return Promise.all([
                    axios.put(fileUploadUrl, file),
                    axios.put(fileMetaUploadUrl, {
                        filename: `${index}.json`,
                        tokenId: index,
                        name: file.name,
                        key: `${index}.${filenamePart[filenamePart.length - 1]}`,
                        filetype: file.type,
                    }, {
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }),
                ]);
            })
            .then(async () => {
                const signer = await connector?.getSigner();

                const contract: Collection_abi = new Contract(
                    collection,
                    CollectionABI as ContractInterface,
                    signer
                ) as Collection_abi;

                const createTx = await contract.mint(index);

                await createTx.wait();
                updateMint(index, `${baseURI}/${index}.json`);
            })
            .catch((error) => console.error('failed to upload file: ', error));
    };

    useEffect(() => {
        if (mint?.meta) {
            fetchFile();
        }
    }, [mint])

    const fetchFile = () => {
        axios.get(mint.meta, {
            headers: {
                'Content-Type': 'application/json',
            }
        })
            .then((resp) => {
                // setImageUrl once mint subgraph handler is fixed
                console.log('image meta: ', resp);
                setImageUrl(`${baseURI}/${resp.data.key}`);
            })
            .catch((error) => console.error('failed to fetch image meta: ', error));
    };

    return (
        <div className="border border-black p-5 aspect-square">
            {imageUrl && <img src={imageUrl} alt={`nft-image-${index}`} className="w-[20px] h-[20px] bg-center bg-cover"/>}
            {address === owner && (update || !mint) && <>
                <label className="input-group w-min">
                    <input
                        type="file"
                        className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-secondary file:text-violet-900 hover:file:bg-secondary-focus hover:file:text-violet-300"
                        onChange={captureFile}
                        accept="image/*, video/*"
                    />
                </label>
                <button className="my-3 retro-btn" onClick={handleUploadFile}>
                    Upload File
                </button>
                {mint?.tokenId && <button className="my-3 retro-btn" onClick={() => setUpdate(false)}>
                    cancel
                </button>}
            </>}
            {(
                isConnected &&
                address === owner &&
                address !== mint?.address &&
                mint?.tokenId
            ) && <button className="my-3 retro-btn" onClick={() => setUpdate(true)}>
                Update File
            </button>}
        </div>
    );
}

export default Block;
